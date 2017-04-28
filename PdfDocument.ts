import { IPdfObject, IStringMap, PdfReference, IPdfResource } from "./PdfObject"
import { Graphics } from "./Graphics";

const pageCatalogId = 1;
const pagesId = 2;

export class PdfDocument {
    private _version: string = "1.6";
    private _pages: Array<PdfPage> = new Array<PdfPage>();
    private _idCount: number = 2;

    constructor() {
    }

    get version(): string {
        return this._version;
    }

    get pages(): Array<PdfPage> {
        return this._pages;
    }

    get currentId(): number {
        return this._idCount;
    }

    public generatePdf(): Blob {
        var generator = new PdfGenerator(this);
        return generator.toBlob();
    }

    public toArrayBuffer(): ArrayBuffer {
        var generator = new PdfGenerator(this);
        return generator.toBuffer();
    }

    public newPage(options: IPdfPageOptions): PdfPage {
        let page = new PdfPage(this, options);
        this._pages.push(page);

        return page;
    }

    getNextId(): number {
        return ++this._idCount;
    }
}

abstract class PdfObject {
    private _id: number;

    constructor(private _document: PdfDocument) {
        this._id = this._document.getNextId();
    }

    get id(): number {
        return this._id;
    }
  
    abstract render(): string;
}

export interface IPdfPageOptions {
    pageSize: IPageSize;
}

export class PdfPage extends PdfObject {
    private _graphics: Graphics;

    constructor(document: PdfDocument, private _options: IPdfPageOptions) {
        super(document);

        this._graphics = new Graphics();
    }

    public get graphics(): Graphics {
        return this._graphics;
    }

    getObjects(getNextId: () => number): IPdfObject[] {
        let objects = new Array<IPdfObject>();
        let graphics = this._graphics.getObjects(getNextId);

        let resources = {
            type: null,
            id: getNextId(),
            resources: graphics.resources,
            properties: {
                ProcSet: [ "PDF", "Text", "ImageB", "ImageC", "ImageI" ] 
            }
        }

        if (graphics.objects.length > 0) {
            objects.push(...graphics.objects);
        }

        let contents = {
            type: null,
            id: getNextId(),
            properties: {
                Length: graphics.stream.length
            },
            stream: graphics.stream
        }

        objects.push(contents);
        objects.push(resources);
        objects.push({
            type: "Page",
            id: this.id,
            properties: {
                Parent: new PdfReference(pagesId),
                MediaBox: [0, 0, this._options.pageSize.width, this._options.pageSize.height],
                Contents: new PdfReference(contents.id),
                Resources: new PdfReference(resources.id)
            }
        })

        return objects;
    }

    render(): string {
        let content = "";

        return content;
    }
}

class PdfGenerator {
    private _document: PdfDocument;

    constructor(document: PdfDocument) {
        this._document = document;
    }

    private encode(): ArrayBuffer {
        let contentLength: number = 0;
        let content = new Array<string>();
        let id: number = 0;
        let offsets = [];
        
        function newObject(id: number, type: string, properties: IStringMap<any>): IPdfObject {
            return {
                id: id,
                type: type,
                properties: properties
            };
        }

        function write(text: string) {
            content.push(text);
            contentLength += text.length + 1;
        }

        function convertValue(value: any): string {
            let result: string;
            if (typeof value === 'string') {
                result = `/${value}`;
            } else if (value instanceof PdfReference) {
                result =`${value.toString()}`;
            } else if (Array.isArray(value)) {
                result = "["

                for (let i = 0; i < value.length; i++) {
                    result += convertValue(value[i]);
                    result += " ";
                }

                result += "]";
            }
            else {
                result= `${value}`;
            }

            return result;
        }

        function writeObject(object: IPdfObject) {            
            if (object.id != null) {
                offsets[object.id] = contentLength;
                write(`${object.id} 0 obj`);
            }
            write(`<<`);
            if (object.type != null) {
                write(`/Type /${object.type}`);
            }
            
            for (let key in object.properties) {
                let value = object.properties[key];
                write(`/${key} ${convertValue(value)}`);
            }
            
            if (object.resources != null) {
                for (let i = 0; i < object.resources.length; i++) {
                    let resource = object.resources[i];
                    write(`/${resource.type} << /${resource.name} ${resource.id.toString()} >>`)
                }
            }

            write(`>>`);

            if (object.stream != null) {
                write("stream");
                write(object.stream);
                write("endstream")
            }

            if (object.id != null) {
                write(`endobj`);
            }
        }

        function writeResource(resource: IPdfResource) {

        }

        write(`%PDF-${this._document.version}`);
        write("%\xFF\xFF\xFF\xFF");

        let pageCatalog = newObject(pageCatalogId, "Catalog", {
            Pages: new PdfReference(2)
        });

        let kids = new Array<PdfReference>();
        for (let i = 0; i < this._document.pages.length; i++) {
            kids.push(new PdfReference(this._document.pages[i].id));
        }

        let pages = newObject(pagesId, "Pages", {
            Count: this._document.pages.length,
            Kids: kids
        });

        writeObject(pageCatalog);
        writeObject(pages);

        let that = this;
        for (let i = 0; i < this._document.pages.length; i++) {
            var objects = this._document.pages[i].getObjects(() => {
                return that._document.getNextId();
            });

            objects.forEach(element => {
                writeObject(element);
            });

            write(this._document.pages[i].render());
        }

        let offset = contentLength;

        write("xref");
        write(`0 ${this._document.currentId + 1}`);
        let prefix = "0000000000";
        write(`${prefix} 65535 f`);
        for (let i = 0; i < offsets.length; i++) {
            if (offsets[i] != null) {
                write(`${(prefix + offsets[i]).slice(-10)} 00000 n`);
            }
        }

        write("trailer");
        writeObject({
            properties: {
                Size: this._document.currentId + 1,
                Root: new PdfReference(pageCatalogId)
            }
        })
        write("startxref");
        write(`${offset}`);
        write("%%EOF\n");
        let contents = content.join("\n");
        let buffer = new ArrayBuffer(contents.length);
        let array = new Uint8Array(buffer);

        let length = contents.length;
        while (length--) {
            array[length] = contents.charCodeAt(length);
        }

        return buffer;
    }

    public toBuffer(): ArrayBuffer {
        return this.encode();
    }

    public toBlob(): Blob {
        return new Blob([this.encode()], {
          type: "application/pdf"
        });
    }
}

interface IPageSize {
    width: number;
    height: number;
}

export class PageSizes {
    static A0: IPageSize = { width: 2383.94,height:  3370.39 };
    static A1: IPageSize = { width: 1683.78,height:  2383.94 };
    static A2: IPageSize = { width: 1190.55,height:  1683.78 };
    static A3: IPageSize = { width: 841.89, height: 1190.55 };
    static A4: IPageSize = { width: 595.28, height: 841.89 };
    static A5: IPageSize = { width: 419.53, height: 595.28 };
    static A6: IPageSize = { width: 297.64, height: 419.53 };
    static A7: IPageSize = { width: 209.76, height: 297.64 };
    static A8: IPageSize = { width: 147.40, height: 209.76 };
    static A9: IPageSize = { width: 104.88, height: 147.40 };
    static A10: IPageSize = { width: 73.70, height: 104.88 };
}


