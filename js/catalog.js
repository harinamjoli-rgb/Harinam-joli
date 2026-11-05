window.HarinamConfig = Object.freeze({
  apiBase: ["localhost", "127.0.0.1"].includes(location.hostname)
    ? "/api"
    : "https://admin.harinamjoli.in/wp-json/harinam/v1",
});
