import { minioClient, bucketName } from '$lib/server/minio';
import { logger } from '$lib/server/logger';

const UPLOADS_DIR = './uploads';

export class StorageService {
    static async getBookFile(minioKey: string | null, localPath: string): Promise<Uint8Array | null> {
        let buffer: Uint8Array | null = null;

        // Try MinIO first
        if (minioKey) {
            try {
                const stream = await minioClient.getObject(bucketName, minioKey);
                const chunks: any[] = [];
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                buffer = Buffer.concat(chunks);
                logger.debug({ minioKey }, 'Successfully fetched book from MinIO');
                return buffer;
            } catch (minioError) {
                logger.error({ err: minioError, minioKey }, 'Failed to get book from MinIO');
            }
        }

        // Fallback to local storage
        if (!buffer && localPath) {
            const fullPath = `${UPLOADS_DIR}/${localPath}`;
            const file = Bun.file(fullPath);
            if (await file.exists()) {
                const arrayBuffer = await file.arrayBuffer();
                buffer = new Uint8Array(arrayBuffer);
                logger.debug({ localPath: fullPath }, 'Fetched book from local storage');
                return buffer;
            }
        }

        return null;
    }

    static async saveBookFile(file: File, buffer: Uint8Array, hash: string): Promise<{ minioKey: string | null, localPath: string }> {
        const uuid = crypto.randomUUID();
        const localPath = `${uuid}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

        // Save locally
        await Bun.write(`${UPLOADS_DIR}/${localPath}`, buffer);
        logger.debug({ localPath }, 'Saved file locally');

        // Try MinIO
        const minioKey = `${hash}.epub`;
        let minioUploaded = false;
        try {
             await minioClient.putObject(bucketName, minioKey, Buffer.from(buffer), buffer.length, {
                 'Content-Type': 'application/epub+zip'
             });
             minioUploaded = true;
             logger.info({ minioKey, bucketName }, 'Uploaded file to MinIO');
        } catch(minioError) {
             logger.error({ err: minioError, minioKey }, 'MinIO upload error');
        }

        return { minioKey: minioUploaded ? minioKey : null, localPath };
    }
}
