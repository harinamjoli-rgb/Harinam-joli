const view = document.querySelector("#profile-view");
const form = document.querySelector("#profile-form");
const message = document.querySelector("#profile-message");

const renderProfile = () => {
  const user = HarinamShop.currentUser();
  if (!user) return;
  document.querySelector("#profile-first-name").textContent =
    user.firstName || "Not added";
  document.querySelector("#profile-last-name").textContent =
    user.lastName || "Not added";
  document.querySelector("#profile-email").textContent = user.email;
  document.querySelector("#profile-mobile").textContent =
    user.phone || "Not added";
};

const showEdit = () => {
  const user = HarinamShop.currentUser();
  form.elements.firstName.value = user.firstName;
  form.elements.lastName.value = user.lastName;
  form.elements.email.value = user.email;
  form.elements.phone.value = user.phone;
  message.textContent = "";
  view.hidden = true;
  form.hidden = false;
};

HarinamShop.sessionReady
  .then(() => {
    if (!HarinamShop.currentUser()) {
      location.replace("account.html?return=profile.html");
      return;
    }
    renderProfile();
    document.querySelector("#edit-profile").addEventListener("click", showEdit);
    document.querySelector("#cancel-profile").addEventListener("click", () => {
      form.hidden = true;
      view.hidden = false;
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type=submit]");
      message.textContent = "";
      button.disabled = true;
      try {
        await HarinamShop.updateProfile(
          Object.fromEntries(new FormData(form)),
        );
        renderProfile();
        form.hidden = true;
        view.hidden = false;
      } catch (error) {
        message.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
  })
  .catch((error) => {
    message.textContent = error.message;
  });

