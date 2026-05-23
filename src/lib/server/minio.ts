import * as Minio from 'minio';
import { env } from '$env/dynamic/private';

const minioClient = new Minio.Client({
    endPoint: env.MINIO_ENDPOINT || 'localhost',
    port: env.MINIO_PORT ? parseInt(env.MINIO_PORT, 10) : 9000,
    useSSL: env.MINIO_USE_SSL === 'true',
    accessKey: env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: env.MINIO_SECRET_KEY || 'minioadminpassword',
});

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
ensureBucketExists();

export { minioClient, bucketName };
