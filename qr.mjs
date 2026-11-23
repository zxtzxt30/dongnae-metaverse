import QRCode from 'qrcode';
const url=new URL('https://zxtzxt30.github.io/dongnae-metaverse/join/');
if(!process.env.EVENT_TOKEN)throw Error('Set EVENT_TOKEN');
url.hash=new URLSearchParams({invite:process.env.EVENT_TOKEN}).toString();
await QRCode.toFile('event-qr.png',url.href,{width:900,margin:4,errorCorrectionLevel:'M'});
console.log('Created event-qr.png');

