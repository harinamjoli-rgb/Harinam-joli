(function () {
  const getTracking = async (reference, email) => {
    const user = HarinamShop.currentUser();
    if (!user) throw new Error("Please sign in to track your order.");
    if (String(email || "").trim().toLowerCase() !== user.email.toLowerCase())
      throw new Error("Use the email address on your signed-in account.");
    const result = await HarinamShop.request(
      `/tracking/${encodeURIComponent(String(reference || "").trim())}`,
    );
    return { order: result.order, ...result.tracking };
  };
  window.HarinamTracking = { getTracking };
})();
