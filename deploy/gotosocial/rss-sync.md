# Auto-sync `notes` to GoToSocial

This keeps your `https://fft.im/notes/rss.xml` feed mirrored to your GoToSocial account.

The script:

- fetches the notes RSS feed
- remembers which items were already posted
- posts only new notes to GoToSocial
- safely bootstraps on first run so it does **not** spam your whole archive by default

## Files

- `scripts/sync-rss-to-gotosocial.mjs`
- `deploy/gotosocial/rss-sync.env.example`
- `deploy/gotosocial/rss-sync.service.example`
- `deploy/gotosocial/rss-sync.timer.example`

## 1. Create a GoToSocial access token

GoToSocial's client API uses OAuth tokens. The official docs describe both:

- the CLI/browser OAuth flow
- getting an access token from the settings panel

Recommended here: create a token in the web UI with at least `write:statuses` permission.

Docs:

- https://docs.gotosocial.org/en/latest/api/authentication/
- https://docs.gotosocial.org/zh-cn/latest/api/authentication/

## 2. Copy the sync script and config to the VPS

If your blog repo is **not** checked out on the VPS, copy the script itself first:

```bash
sudo mkdir -p /opt/gotosocial/scripts
sudo cp /path/to/blog/scripts/sync-rss-to-gotosocial.mjs /opt/gotosocial/scripts/sync-rss-to-gotosocial.mjs
sudo chown root:root /opt/gotosocial/scripts/sync-rss-to-gotosocial.mjs
sudo chmod 755 /opt/gotosocial/scripts/sync-rss-to-gotosocial.mjs
```

Then copy the env file:

```bash
sudo cp /path/to/blog/deploy/gotosocial/rss-sync.env.example /opt/gotosocial/rss-sync.env
sudo chown root:root /opt/gotosocial/rss-sync.env
sudo chmod 600 /opt/gotosocial/rss-sync.env
sudo vim /opt/gotosocial/rss-sync.env
```

Set at least:

```env
GTS_BASE_URL=https://social.fft.im
GTS_ACCESS_TOKEN=your_real_token
RSS_SYNC_FEED_URL=https://fft.im/notes/rss.xml
RSS_SYNC_STATE_FILE=/opt/gotosocial/rss-sync-state.json
```

## 3. First-run bootstrap

The script is intentionally safe:

- if there is no state file yet
- and `RSS_SYNC_BACKFILL=false`

then it marks the current feed items as already seen and exits without posting anything.

That means your history will not be reposted accidentally.

Run this once:

If the script lives at `/opt/gotosocial/scripts/sync-rss-to-gotosocial.mjs`, run:

```bash
cd /opt/gotosocial
set -a
source /opt/gotosocial/rss-sync.env
set +a
node /opt/gotosocial/scripts/sync-rss-to-gotosocial.mjs --bootstrap
```

If you want to see what would happen without posting:

```bash
cd /opt/gotosocial
set -a
source /opt/gotosocial/rss-sync.env
set +a
node /opt/gotosocial/scripts/sync-rss-to-gotosocial.mjs --dry-run
```

## 4. Manual test

```bash
cd /opt/gotosocial
set -a
source /opt/gotosocial/rss-sync.env
set +a
node /opt/gotosocial/scripts/sync-rss-to-gotosocial.mjs
```

If a new note exists, the script will post it to:

- `https://social.fft.im`

using:

- a write-scoped OAuth token
- the GoToSocial client API

## 5. systemd timer

Copy the unit files:

```bash
sudo cp /path/to/blog/deploy/gotosocial/rss-sync.service.example /etc/systemd/system/rss-sync.service
sudo cp /path/to/blog/deploy/gotosocial/rss-sync.timer.example /etc/systemd/system/rss-sync.timer
```

Edit `/etc/systemd/system/rss-sync.service` and replace `/path/to/blog` with your real repo path.

If you copied the script into `/opt/gotosocial/scripts/`, use:

- `WorkingDirectory=/opt/gotosocial`
- `ExecStart=/usr/bin/node /opt/gotosocial/scripts/sync-rss-to-gotosocial.mjs`

Then enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now rss-sync.timer
sudo systemctl list-timers rss-sync.timer
```

Check logs:

```bash
journalctl -u rss-sync.service -n 100 --no-pager
```

## Notes

- The script defaults to `https://fft.im/notes/rss.xml`, because you said you want to sync `note`.
- If you ever want to sync blog posts instead, change `RSS_SYNC_FEED_URL` to `https://fft.im/rss.xml`.
- The current post format is:

```text
<title>

<note content or summary>

<link>
```

- For modern feeds, the script prefers full RSS content automatically.
- `RSS_SYNC_INCLUDE_DESCRIPTION=true` is mainly useful for older feeds that only expose descriptions.
- If you don't want a leading label like `New note:`, leave `RSS_SYNC_PREFIX` empty.

## References

- GoToSocial API authentication: https://docs.gotosocial.org/en/latest/api/authentication/
- GoToSocial API authentication (Chinese): https://docs.gotosocial.org/zh-cn/latest/api/authentication/
- GoToSocial swagger index: https://docs.gotosocial.org/zh-cn/latest/api/swagger/
