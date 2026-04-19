const PasswordUtil = {

  openPasswordPopup() {
    const popupWidth = 400;
    const popupHeight = 250;
    const left = (window.screen.width / 2) - (popupWidth / 2);
    const top = (window.screen.height / 2) - (popupHeight / 2);
    window.open(
      'password.html',
      'passwordPopup',
      `width=${popupWidth},height=${popupHeight},top=${top},left=${left},resizable=yes`
    );
  }

};