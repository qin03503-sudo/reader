import * as Minio from 'minio';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';

const globalForMinio = globalThis as unknown as {
    minioClient: Minio.Client | undefined;
};

const minioClient = globalForMinio.minioClient ?? new Minio.Client({
    endPoint: env.MINIO_ENDPOINT || '127.0.0.1',
    port: env.MINIO_PORT ? parseInt(env.MINIO_PORT, 10) : 9000,
    useSSL: env.MINIO_USE_SSL === 'true',
    accessKey: env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: env.MINIO_SECRET_KEY || 'minioadminpassword',
});

if (process.env.NODE_ENV !== 'production') globalForMinio.minioClient = minioClient;

const bucketName = env.MINIO_BUCKET || 'reader-uploads';

// Initialize bucket if it doesn't exist
async function ensureBucketExists() {
    try {
        const exists = await minioClient.bucketExists(bucketName);
        if (!exists) {
            await minioClient.makeBucket(bucketName, 'us-east-1');
            console.log(`Bucket "${bucketName}" created successfully.`);
        }
    } catch (error) {
        console.error('Error ensuring bucket exists:', error);
    }
}

// Ensure the bucket exists when the module is loaded
if (!building) {
    ensureBucketExists();
}

export { minioClient, bucketName };
