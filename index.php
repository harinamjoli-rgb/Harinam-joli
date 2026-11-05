<?php
declare(strict_types=1);

$timezone = new DateTimeZone('Asia/Kolkata');
$launchAt = new DateTimeImmutable('2026-09-04 05:15:00', $timezone);
$now = new DateTimeImmutable('now', $timezone);
$isLive = $now >= $launchAt;

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

if (isset($_GET['launch_status'])) {
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode([
        'live' => $isLive,
        'now_ms' => $now->getTimestamp() * 1000,
        'launch_ms' => $launchAt->getTimestamp() * 1000,
    ]);
    exit;
}

if ($isLive) {
    header('Content-Type: text/html; charset=UTF-8');
    readfile(__DIR__ . '/store.html');
    exit;
}

$launchMilliseconds = $launchAt->getTimestamp() * 1000;
$serverMilliseconds = $now->getTimestamp() * 1000;
?>
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Launching Soon | Harinam Joli</title>
    <style>
      * { box-sizing: border-box; }
      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        padding: 24px;
        color: #fff8e9;
        font-family: Arial, sans-serif;
        text-align: center;
        background:
          linear-gradient(rgba(43, 11, 8, .76), rgba(43, 11, 8, .9)),
          url('assets/hero-banner-1.webp?v=2') center / cover no-repeat;
      }
      main {
        width: min(760px, 100%);
        padding: clamp(28px, 6vw, 64px);
        border: 1px solid rgba(255, 216, 126, .45);
        border-radius: 20px;
        background: rgba(53, 14, 11, .78);
        box-shadow: 0 24px 70px rgba(0, 0, 0, .35);
        backdrop-filter: blur(6px);
      }
      .logo { width: min(210px, 60vw); height: auto; }
      h1 { margin: 24px 0 10px; font-family: Georgia, serif; font-size: clamp(34px, 7vw, 64px); font-weight: 400; }
      .intro { margin: 0 0 30px; color: #f6dfad; font-size: clamp(16px, 2.5vw, 20px); }
      .countdown { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
      .countdown div { padding: 18px 8px; border-radius: 12px; background: rgba(255, 248, 233, .1); }
      .countdown strong { display: block; color: #ffd77e; font-size: clamp(28px, 6vw, 48px); font-variant-numeric: tabular-nums; }
      .countdown span { display: block; margin-top: 5px; color: #f6dfad; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
      .launch-time { margin: 26px 0 0; line-height: 1.6; }
      @media (max-width: 520px) {
        .countdown { grid-template-columns: repeat(2, 1fr); }
      }
    </style>
  </head>
  <body>
    <main>
      <img class="logo" src="assets/harinam-logo.png" alt="Harinam Joli" />
      <h1>We’re Launching Soon</h1>
      <p class="intro">Carry your devotion with Harinam Joli.</p>
      <section class="countdown" aria-label="Time remaining until website launch">
        <div><strong id="days">00</strong><span>Days</span></div>
        <div><strong id="hours">00</strong><span>Hours</span></div>
        <div><strong id="minutes">00</strong><span>Minutes</span></div>
        <div><strong id="seconds">00</strong><span>Seconds</span></div>
      </section>
      <p class="launch-time">Launching on<br /><strong>4 September 2026 · 5:15 AM IST</strong></p>
    </main>
    <script>
      (() => {
        const launchAt = <?php echo $launchMilliseconds; ?>;
        const serverOffset = <?php echo $serverMilliseconds; ?> - Date.now();
        const fields = ['days', 'hours', 'minutes', 'seconds'];
        const units = [86400000, 3600000, 60000, 1000];

        function updateCountdown() {
          let remaining = launchAt - (Date.now() + serverOffset);
          if (remaining <= 0) {
            window.location.replace('/');
            return;
          }

          fields.forEach((field, index) => {
            const value = Math.floor(remaining / units[index]);
            remaining %= units[index];
            document.getElementById(field).textContent = String(value).padStart(2, '0');
          });
        }

        updateCountdown();
        setInterval(updateCountdown, 1000);
      })();
    </script>
  </body>
</html>
