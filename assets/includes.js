document.addEventListener("DOMContentLoaded", function () {

  async function loadIncludes() {
    const headerBox = document.getElementById("header-include");
    const footerBox = document.getElementById("footer-include");

    if (headerBox) {
      const headerResponse = await fetch("/includes/header.html");
      headerBox.innerHTML = await headerResponse.text();
    }

    if (footerBox) {
      const footerResponse = await fetch("/includes/footer.html");
      footerBox.innerHTML = await footerResponse.text();
    }

    initMobileMenu();
  }

  function initMobileMenu() {
    const hamburger = document.querySelector(".pr-hamburger");
    const menu = document.querySelector(".pr-menu");

    if (!hamburger || !menu) return;

    hamburger.addEventListener("click", function () {
      menu.classList.toggle("active");
      hamburger.classList.toggle("active");
    });

    document.querySelectorAll(".pr-dropbtn").forEach(function (button) {
      button.addEventListener("click", function (e) {
        if (window.innerWidth <= 991) {
          e.preventDefault();
          this.parentElement.classList.toggle("active");
        }
      });
    });
  }

  loadIncludes();

});