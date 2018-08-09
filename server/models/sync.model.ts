import { get } from "config";
import { existsSync, statSync, createReadStream } from 'fs';
import { extname, join } from "path";
const mime = require('mime-types')

export class SyncModel {
    dive_folder_id: string;
    googleDrive: any;
    root: any;
    root_directory: string;

    constructor(googleDrive: any) {
        this.googleDrive = googleDrive;
        this.dive_folder_id = get('drive_folder_id');
        this.root_directory = get('root_directory')
    }

    async file_sync(file_name: string, action?: string ) {
        this.root = await this.googleDrive.getFolderById(this.dive_folder_id);
        let path = join(this.root_directory, file_name);
        if( !existsSync(path) )
            await this.delete(file_name);
        else if( action == 'change'){
            await this.delete(path);
            await this.upload(path, file_name);
        }
        else
            await this.upload(path, file_name);
    }

    async upload(path:string, file_name: string){
        let file:any;
        if( statSync(path).isDirectory() )
            file = await this.create_directory(path);
        else{
            await this.remove_existing(file_name);
            file = await this.create_file(path, file_name);
            await this.sync(file, path);
        }
    }

    async remove_existing(file_name:string){
        // Find files in root folder
        const childFiles = await this.root.getChildFiles({
            query: `name contains '${file_name}'`
        });
    
        // Delete files
        for (const childFile of childFiles) {
            await childFile.delete();
        }
    }

    async create_directory(path:any){
        const file = await this.root.createChildFolder({
            name: path
        });
        return file;
    }
    
    async create_file(path:any, file_name:string){
        const file = await this.root.createChildFile({
            name: file_name,
            mimeType: mime.contentType(extname(path))
        });
        return file
    }

    async delete(path:string) {
        // Find files in root folder
        const childFiles = await this.root.getChildFiles({
            query: `name contains '${path}'`
        });

        // Delete files
        for (const childFile of childFiles) {
            await childFile.delete();
        }
    }

    async sync(file:any, path:any){
        await file.resumableCreate({
            contentLength: statSync(path).size,
            readableCallback: (position: any) => createReadStream(path, { start: position })
        });
    }
}