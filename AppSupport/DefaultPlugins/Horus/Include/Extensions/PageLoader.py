from HorusAPI import PluginPage

htmlLoader = PluginPage(
    id="html_loader",
    name="HTML Loader",
    description="Load HTML files into Horus",
    html="pageloader.html",
    hidden=True,
)

imageLoader = PluginPage(
    id="image_loader",
    name="Image Loader",
    description="Load images into Horus",
    html="imageloader.html",
    hidden=True,
)

csvLoader = PluginPage(
    id="csv_loader",
    name="CSV Loader",
    description="Load CSV files into Horus",
    html="csvloader.html",
    hidden=True,
)

pdfLoader = PluginPage(
    id="pdf_loader",
    name="PDF Loader",
    description="Load PDF files into Horus",
    html="pdfloader.html",
    hidden=True,
)

plotLoader = PluginPage(
    id="plot_loader",
    name="Plot Loader",
    description="Load plots from CSV files into Horus",
    html="plotloader.html",
    hidden=True,
)
