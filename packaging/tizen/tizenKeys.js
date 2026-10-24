// Tizen TV Remote Media Key Registration
if (typeof tizen !== 'undefined' && tizen.tvinputdevice) {
  var registeredKeys = [
    'MediaPlay',
    'MediaPause',
    'MediaPlayPause',
    'MediaFastForward',
    'MediaRewind',
    'MediaStop',
    'MediaTrackNext',
    'MediaTrackPrevious',
    'VolumeUp',
    'VolumeDown',
    'VolumeMute',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
  ];

  registeredKeys.forEach(function(keyName) {
    try {
      tizen.tvinputdevice.registerKey(keyName);
    } catch (e) {
      // Key may already be registered or unsupported on older firmware
    }
  });

  // Handle Tizen Remote Return/Back Button (Key Code 10009)
  window.addEventListener('keydown', function(e) {
    if (e.keyCode === 10009 || e.key === 'Return' || e.key === 'XF86Back') {
      // If we are at the root or Leanback TV home, ask to exit or exit
      var hash = window.location.hash || '';
      if (!hash || hash === '#/' || hash === '#/tv') {
        try {
          if (typeof tizen !== 'undefined' && tizen.application) {
            tizen.application.getCurrentApplication().exit();
          }
        } catch (err) {
          console.error('Exit app failed', err);
        }
      } else {
        window.history.back();
      }
    }
  });
}

