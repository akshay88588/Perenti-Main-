export function handleShareAction(action, showToast) {
  const shareUrl = window.location.href;
  const shareText = "Check out the Ebc 28th Meetup on Perenti! Join other founders & builders:";

  switch (action) {
    case 'copy':
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast("Link copied to clipboard!");
      }).catch(err => console.error("Failed to copy link: ", err));
      break;
    case 'whatsapp': {
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
      window.open(waUrl, '_blank');
      break;
    }
    case 'facebook': {
      const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
      window.open(fbUrl, '_blank');
      break;
    }
    case 'twitter': {
      const twUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
      window.open(twUrl, '_blank');
      break;
    }
    case 'snapchat': {
      const scUrl = `https://www.snapchat.com/share?url=${encodeURIComponent(shareUrl)}`;
      window.open(scUrl, '_blank');
      break;
    }
    case 'instagram':
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast("Link copied! Share it on your Instagram bio/story.");
        setTimeout(() => {
          window.open('https://www.instagram.com/', '_blank');
        }, 1200);
      }).catch(err => console.error("Failed to copy link: ", err));
      break;
    case 'linkedin': {
      const liUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
      window.open(liUrl, '_blank');
      break;
    }
    default:
      break;
  }
}
