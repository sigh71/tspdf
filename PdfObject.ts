export interface IStringMap<T> {
    [x: string]: T;
}

export interface IPdfObject {
    id?: number;
    type?: string;
    properties?: IStringMap<any>;
    stream?: string;
    resources?: IPdfResource[];
}

export class PdfReference {
    constructor(private _id: number){        
    }

    toString(): string {
        return `${this._id} 0 R`;
    }
}

export interface IPdfResource {
    type: string;
    name: string;
    id: PdfReference;
}