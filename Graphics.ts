import { IPdfObject, PdfReference, IPdfResource } from "./PdfObject"

export class Resources {
    private _fonts = new Array<IPdfObject>();
    private _patternBrushes= new Array<TilingPatternBrush>();

    get fonts(): Array<IPdfObject> {
        return this._fonts;
    }

    get patternBrushes(): Array<TilingPatternBrush> {
        return this._patternBrushes;
    }
}

export class Graphics {
    private _graphics: Array<IGraphicAction> = new Array<IGraphicAction>();

    public drawRectangle(pen: Pen, brush: Brush, x: number, y: number, width: number, height: number) {
        this._graphics.push(new Rectangle(pen, brush, x, y, width, height));
    }

    public getObjects(getNextId: () => number) : { stream: string, resources?: IPdfResource[], objects: IPdfObject[] }  {
        let objects = new Array<IPdfObject>();
        let streams = new Array<string>();
        let resources = new Array<IPdfResource>();

        for (let i = 0; i < this._graphics.length; i++) {
            let results = this._graphics[i].render(getNextId);
            streams.push(results.stream);

            if (results.resources != null && results.resources.length > 0) {
                resources.push(...results.resources);
            }

            if (results.objects != null && results.objects.length > 0) {
                objects.push(...results.objects);
            }
        }

        let stream = streams.join("\n");
        let contents = {
            type: null,
            id: getNextId(),
            properties: {
                Length: stream.length
            },
            stream: stream
        }

        return { stream: stream, resources: resources, objects: objects };
    }
}

interface IGraphicAction {
    render(getNextId: () => number): { stream: string, resources?: IPdfResource[], objects?: IPdfObject[]};
}

class Rectangle implements IGraphicAction {
    constructor(private _pen: Pen, private _brush: Brush, private _x: number, private _y: number, private _width: number, private _height: number) {
    }

    render(getNextId: () => number): { stream: string, resources?: IPdfResource[], objects?: IPdfObject[] } {
        var objects = new Array<IPdfObject>();
        var resources = new Array<IPdfResource>();

        if (this._pen == null && this._brush == null) {
            return null;
        }

        let stream = Array<string>();
        if (this._brush != null) {
            var contents = brushToRenderer(this._brush).render(getNextId);
            stream.push(contents.stream);

            if (contents.resources != null && contents.resources.length > 0) {
                resources.push(...contents.resources);
            }

            if (contents.objects != null && contents.objects.length > 0) {
                objects.push(...contents.objects);
            }
        }

        if (this._pen != null) {
            stream.push(new PenRenderer(this._pen).render(getNextId).stream);
        }

        stream.push(`${this._x} ${this._y} ${this._width} ${this._height} re`);

        if (this._pen != null && this._brush != null) {
            stream.push("B");
        } else if (this._brush != null) {
            stream.push("f");
        } else {
            stream.push("S");
        }

        return { stream: stream.join("\n"), resources: resources, objects: objects };
    }
}

abstract class Opacity {
    private _opacity: number = 1;
    public get opacity(): number {
        return this._opacity;
    }

    public set opacity(o: number) {
        this._opacity = o;
    }
}

function brushToRenderer(brush: Brush): IGraphicAction {
    if (brush instanceof SolidColorBrush) {
        return new SolidColorBrushRenderer(brush);
    } else if (brush instanceof TilingPatternBrush) {
        return new TilingPatternBrushRenderer(brush);
    }

    return null;
}

abstract class Brush extends Opacity {
}

export class SolidColorBrush extends Brush {
    constructor(private _color) {
        super();
    }

    get color(): Color {
        return this._color;
    }
}

class SolidColorBrushRenderer implements IGraphicAction {
    constructor(private _brush: SolidColorBrush) {    
    }

    render(getNextId: () => number): { stream: string, resources?: IPdfResource[], objects?: IPdfObject[] } {
        return { stream:`${this._brush.color.render()} rg` };
    }
}

export class TilingPatternBrush extends Brush {
    private static _patternCount = 1;
    private _graphics: Graphics = new Graphics();
    private _name: string;
    
    constructor(private _width: number, private _height: number) {
        super();

        this._name = `P${TilingPatternBrush._patternCount}`;
        TilingPatternBrush._patternCount++;
    }

    public get graphics(): Graphics {
        return this._graphics;
    }

    public get width(): number {
        return this._width;
    }

    public get height(): number {
        return this._height;
    }

    public get name(): string {
        return this._name;
    }
}

class TilingPatternBrushRenderer implements IGraphicAction {
    constructor(private _brush: TilingPatternBrush) {
    }

    render(getNextId: () => number): { stream: string, resources?: IPdfResource[], objects?: IPdfObject[] } {
        let stream = "";
        let objects = new Array<IPdfObject>();

        let results = this._brush.graphics.getObjects(getNextId);

        // let patternResourcesProperties = {};
        // for (let i = 0; i < results.resources.length; i++) {
        //     patternResourcesProperties[results.resources[i].name] = results.resources[i].id;
        // }

        let patternResources = {
            id: getNextId(),
            //properties: patternResourcesProperties,
            resources: results.resources
        }

        if (results.objects && results.objects.length > 0) {
            objects.push(...results.objects);
        }

        let patternId = getNextId();
        stream = [ "/Pattern cs", `/${this._brush.name} scn`].join("\n");

        let pattern = {
            type: "Pattern",
            id: patternId,
            properties: {
                PatternType: 1,
                PaintType: 1,
                TilingType: 2,
                BBox: [0, 0, this._brush.width, this._brush.height],
                XStep: this._brush.width,
                YStep: this._brush.height,
                Resources: new PdfReference(patternResources.id),
                Length: results.stream.length
            },
            stream: results.stream
        };

        let resource = [{
            type: "Pattern",
            id: new PdfReference(pattern.id),
            name: this._brush.name
        }];

        objects.push(patternResources);
        objects.push(pattern);

        return {stream: stream, resources: resource, objects: objects};
    }
}

export class Pen extends Opacity {
    constructor(private _color: Color, private _width: number) {
        super();
    }

    get width(): number {
        return this._width;
    }

    get color(): Color {
        return this._color;
    }
}

class PenRenderer implements IGraphicAction {
    constructor(private _pen: Pen) {        
    }

    render(getNextId: () => number): { stream: string, resources?: IPdfResource[], objects?: IPdfObject[]} {
        return { stream: [ `${this._pen.width} w`, `${this._pen.color.render()} RG` ].join("\n") };
    }
}

export class Color {
    constructor(private _r: number, private _g: number, private _b: number, private _a: number) {
    }

    public get red(): number {
        return this._r;
    }

    public get green(): number {
        return this._g;
    }

    public get blue(): number {
        return this._b;
    }
    public get alpha(): number {
        return this._a;
    }

    render(): string {
        return `${this._r} ${this._g} ${this._b}`;
    }
}