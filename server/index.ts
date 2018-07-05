
import { get } from 'config';
import { join, extname } from 'path';
import { writeFileSync, statSync, createReadStream, readFileSync, existsSync, watch } from 'fs';
import { createInterface } from 'readline';
const GoogleDrive = require("googledrive");
const mime = require('mime-types')

class AppServer {
    app_patch: string;
    client_secret_path: string;
    token_secret_path: string;
    root_directory: string;
    dive_folder_id: string;
    constructor() {
        this.config()
        this.services()
    }

    config() {
        this.app_patch = process.cwd()
        this.client_secret_path = join(this.app_patch, get('client_secret'))
        this.token_secret_path = join(this.app_patch, get('token_secret'))
        this.root_directory = get('root_directory')
        this.dive_folder_id = get('drive_folder_id');
    }

    services() {
    }

    run(): any {
        watch(this.root_directory, { encoding: 'utf8' }, (eventType, filename) => {
            if (filename && eventType == 'rename') {
                console.log(filename);
                this.file_sync(filename)
            }
        });
    }

    private async get_token( googleDrive:any ) {
        // Authorize
        const authUrl = googleDrive.generateAuthUrl();

        const code = await new Promise((resolve, reject) => {
            console.log(`Authorize URL: ${authUrl}`);

            const rl = createInterface({
                input: process.stdin,
                output: process.stdout
            });
            rl.question("Input your code: ", answer => {
                rl.close();

                if (answer === "") {
                    reject(new Error("Invalid code"));
                    return;
                }
                resolve(answer);
            });
        });
        await googleDrive.getToken(code);
    }

    private async file_sync(filename: string) {
        let client = null,
            token = null,
            file_path: string = join(this.root_directory, filename);

        client = JSON.parse(readFileSync(this.client_secret_path, "utf8"));
        if (existsSync(this.token_secret_path)) {
            try {
                token = JSON.parse(readFileSync(this.token_secret_path, "utf8"));
            } catch (err) {
                // Nothing
            }
        }

        const googleDrive = new GoogleDrive({
            client: client,
            token: token
        });

        googleDrive.on("token", (_token: any) => {
            writeFileSync(this.token_secret_path, JSON.stringify(_token));
        });
        if (token === null) {
            await this.get_token(googleDrive);
        }

        // Get root folder
        const rootFolder = await googleDrive.getFolderById(this.dive_folder_id);

        // Create child file (File has not been created yet)
        const file = rootFolder.createChildFile({
            name: filename,
            mimeType: mime.contentType(extname(file_path))
        });

        // Resumable upload
        await file.resumableCreate({
            contentLength: statSync(file_path).size,
            readableCallback: (position: any) => createReadStream(file_path, { start: position })
        });
    }

    public static bootstrap() {
        return new AppServer().run();
    }
}

export const app = AppServer.bootstrap()