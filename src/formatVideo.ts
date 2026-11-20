// Ce téléphone sait-il fabriquer une vidéo ? Petit module à part : le gros module vidéo n'est chargé qu'au moment d'en créer une.
export function formatVideo(): { mime: string; extension: string } | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const mime of ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']) {
    if (MediaRecorder.isTypeSupported(mime)) return { mime, extension: mime.startsWith('video/mp4') ? 'mp4' : 'webm' };
  }
  return null;
}

export const videoPossible = (): boolean => !!formatVideo() && typeof HTMLCanvasElement.prototype.captureStream === 'function';
