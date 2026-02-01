# Remote Access Support for browser-canvas

This document describes environment variables and CLI flags added to support browser-canvas behind reverse proxies, Tailscale serve, and in remote development environments like code-server.

## Problem Statement

When accessing browser-canvas through a reverse proxy or remote IDE like code-server, several issues arise:

### 1. Mixed Content Blocking
When code-server is served via HTTPS (e.g., through Tailscale serve), the Simple Browser panel cannot load HTTP iframes. Browsers block mixed content (HTTPS page loading HTTP resources).

### 2. WebSocket Protocol Mismatch
HTTPS pages require `wss://` (secure WebSocket), not `ws://`. The original browser-canvas hardcoded `ws://` in generated URLs.

### 3. Incorrect Host in URLs
browser-canvas generates URLs using the bind address (e.g., `127.0.0.1` or `0.0.0.0`). When accessed through a proxy, clients need URLs with the proxy's hostname, not the internal bind address.

### 4. Auto-Open Browser Fails
In headless/remote environments (SSH, containers, code-server), the `open` command fails or opens a browser on the wrong machine. This causes error messages on every canvas creation.

### 5. Dynamic Ports Break Proxy Config
browser-canvas uses port 0 (OS-assigned) by default. This breaks reverse proxy configurations that need stable port numbers.

## Solution: Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `127.0.0.1` | Bind address. Use `0.0.0.0` for external access, `127.0.0.1` for proxy-only. |
| `PORT` | `0` (random) | Server port. Set fixed value for stable proxy config. |
| `CLIENT_HOST` | same as HOST | Hostname for generated URLs. Set to proxy hostname (e.g., `dev-vm.tail1ba2.ts.net`). |
| `CLIENT_PROTOCOL` | `http` | Protocol for URLs. Set to `https` when behind TLS-terminating proxy (enables `wss://`). |
| `BROWSER` | unset | Set to `none` to disable auto-open browser on canvas creation. |

## Solution: CLI Flags

```bash
./server.sh [options]

Options:
  --host <addr>         Bind address (default: 127.0.0.1)
  --port <port>         Server port (default: random)
  --client-host <host>  Hostname for generated URLs
  --no-browser          Disable auto-open browser (sets BROWSER=none)
  --dir <path>          Canvas artifacts directory
```

## Solution: Configuration File

Create `canvas.env` in the browser-canvas directory for persistent configuration:

```bash
# canvas.env - sourced automatically by server.sh
export PORT=9847
export HOST=127.0.0.1
export CLIENT_HOST=dev-vm.tail1ba2.ts.net
export CLIENT_PROTOCOL=https
export BROWSER=none
```

## Example Setups

### Setup 1: Tailscale Serve (Direct)

Access browser-canvas directly via Tailscale serve on a dedicated port.

```bash
# One-time: Configure Tailscale serve
sudo tailscale serve --bg --https=9847 http://127.0.0.1:9847

# Start browser-canvas
PORT=9847 HOST=127.0.0.1 CLIENT_HOST=myhost.tail1ba2.ts.net CLIENT_PROTOCOL=https BROWSER=none ./server.sh
```

**Access URL:** `https://myhost.tail1ba2.ts.net:9847/canvas/{name}`

### Setup 2: code-server + Tailscale Serve

Access browser-canvas via code-server's Simple Browser panel.

```
User Browser (Windows)
    │
    ▼ HTTPS
Tailscale serve (:443 → code-server, :9847 → browser-canvas)
    │
    ▼ HTTP
code-server (:8443) ──Simple Browser──► browser-canvas (:9847)
```

```bash
# Tailscale serve config
sudo tailscale serve --bg https / http://localhost:8443      # code-server
sudo tailscale serve --bg --https=9847 http://127.0.0.1:9847 # browser-canvas

# browser-canvas config
export PORT=9847
export HOST=127.0.0.1
export CLIENT_HOST=myhost.tail1ba2.ts.net
export CLIENT_PROTOCOL=https
export BROWSER=none
```

**Simple Browser URL:** `https://myhost.tail1ba2.ts.net:9847/canvas/{name}`

### Setup 3: Traefik Reverse Proxy (Multi-Container)

Multiple containers running browser-canvas behind a single Traefik entry point.

```
Tailscale serve :443 → Traefik
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    /project-a/*    /project-b/*    /project-c/*
         │               │               │
    Container A     Container B     Container C
    (canvas:9847)   (canvas:9847)   (canvas:9847)
```

**Container environment:**
```bash
HOST=0.0.0.0           # Accept connections from Traefik
PORT=9847
CLIENT_HOST=myhost.tail1ba2.ts.net
CLIENT_PROTOCOL=https
BROWSER=none
```

**Traefik labels:**
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.project-a.rule=PathPrefix(`/project-a`)"
  - "traefik.http.services.project-a.loadbalancer.server.port=9847"
  - "traefik.http.middlewares.project-a-strip.stripprefix.prefixes=/project-a"
  - "traefik.http.routers.project-a.middlewares=project-a-strip"
```

**Access URL:** `https://myhost.tail1ba2.ts.net/project-a/canvas/{name}`

## How TLS Termination Works

```
Browser ──HTTPS──► Proxy (Tailscale/Traefik) ──HTTP──► browser-canvas
                            │
                    TLS terminated here
                            │
                    Adds X-Forwarded-Proto: https
```

The proxy handles HTTPS. browser-canvas runs plain HTTP internally. Setting `CLIENT_PROTOCOL=https` ensures generated WebSocket URLs use `wss://` so browsers accept the connection.

## Files Changed

| File | Changes |
|------|---------|
| `src/server/index.ts` | Added HOST, PORT, CLIENT_HOST, CLIENT_PROTOCOL env vars; updated URL generation |
| `src/server/canvas-manager.ts` | Added BROWSER=none check via `shouldOpenBrowser()` |
| `server.sh` | Added CLI flags; sources `canvas.env` if present |

## Backward Compatibility

All changes are backward compatible:
- Default values match original behavior
- No env vars set = original behavior
- CLI flags are optional
- `canvas.env` is optional

## Use Cases

1. **code-server users** - Access browser-canvas in Simple Browser panel via HTTPS
2. **Remote development** - Run browser-canvas on remote VM, access from local browser
3. **Docker/containers** - Run browser-canvas in containers behind reverse proxy
4. **Tailscale users** - Secure access to browser-canvas over tailnet
5. **Headless servers** - Disable auto-open browser that fails without display
