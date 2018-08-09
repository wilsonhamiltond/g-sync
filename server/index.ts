
import { get } from 'config';
import { join } from 'path';
import { writeFileSync, readFileSync, existsSync, watch } from 'fs';
import { createInterface } from 'readline';
import { SyncModel } from './models/sync.model';
const GoogleDrive = require("googledrive");

class AppServer {
    app_patch: string;
    client_secret_path: string;
    token_secret_path: string;
    root_directory: string;
    dive_folder_id: string;
    googleDrive: any;
    syncModel: SyncModel;
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

    async services() {
        let client = null,
            token = null;

        client = JSON.parse(readFileSync(this.client_secret_path, "utf8"));

        if (existsSync(this.token_secret_path)) {
            try {
                token = JSON.parse(readFileSync(this.token_secret_path, "utf8"));
            } catch (err) {
                // Nothing
            }
        }
        
        this.googleDrive = new GoogleDrive({
            client: client,
            token: token
        });
        if (!existsSync(this.token_secret_path))
            await this.get_token();

        this.syncModel = new SyncModel(this.googleDrive);
    }

    async run() {
        await watch(this.root_directory, { 
            encoding: 'utf8',
            recursive: true 
        }, async (eventType, filename) => {
            if (filename){
                await this.syncModel.file_sync(filename, eventType);
            }
        });
    }

    private async get_token( ) {
        this.googleDrive.on("token", (_token: any) => {
            writeFileSync(this.token_secret_path, JSON.stringify(_token));
        });
        
        const authUrl = this.googleDrive.generateAuthUrl();

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
        await this.googleDrive.getToken(code);
    }

    public static async bootstrap() {
        return await new AppServer().run();
    }
}

export const app = AppServer.bootstrap()