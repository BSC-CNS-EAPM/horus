from flask import Flask, render_template
import webview

app = Flask(__name__,
            template_folder='App/views',
            static_folder='App/static',
            static_url_path='')


@app.route('/')
def index():
    return render_template('molstar/molstar.html')


if __name__ == '__main__':

    window = webview.create_window('Horus', app)
    webview.start(debug=True)
