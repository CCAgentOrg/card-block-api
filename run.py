from app import create_app, Config
import os

config_name = os.getenv('FLASK_CONFIG') or 'default'
app = create_app(Config)

if __name__ == '__main__':
    host = os.environ.get('FLASK_RUN_HOST', '127.0.0.1')
    port = int(os.environ.get('FLASK_RUN_PORT', 5000))
    debug = app.config.get('DEBUG', False)
    app.run(host=host, port=port, debug=debug)
