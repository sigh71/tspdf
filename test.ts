import fs = require('fs');
import { PdfDocument, PdfPage, PageSizes } from "./PdfDocument";
import { Pen, Color, SolidColorBrush, TilingPatternBrush } from "./Graphics";

var doc = new PdfDocument();
var page = doc.newPage({ pageSize: PageSizes.A4});
page.graphics.drawRectangle(new Pen(new Color(1, 0, 0, 1), 2), new SolidColorBrush(new Color(0, 1, 0, 1)), 10, 10, 50, 50);

var brush = new TilingPatternBrush(20, 20);
brush.graphics.drawRectangle(new Pen(new Color(1, 0, 0, 1), 1), null, 0, 0, 10, 10);
brush.graphics.drawRectangle(new Pen(new Color(0, 1, 0, 1), 1), new SolidColorBrush(new Color(0, 1, 1, 1)), 10, 10, 10, 10);

page.graphics.drawRectangle(new Pen(new Color(0, 0, 1, 1), 1), brush, 70, 70, 100, 100);
var buffer = doc.toArrayBuffer();
var b = new Buffer(buffer);

fs.writeFile("test.pdf", b, "binary");