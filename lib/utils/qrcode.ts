import QRCode from "qrcode";

export async function generateQRCode(data: string, size: number = 256) {
    const qrCode = await QRCode.toDataURL(data, { width: size });
    return qrCode;
}

