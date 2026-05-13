import os
import json
from flask import Flask, send_from_directory
from flask_restx import Api
from .config import Config


def load_bank_data(app):
    """Load bank data from JSON file into app config."""
    data_path = os.path.join(app.root_path, 'data', 'banks.json')
    try:
        with open(data_path, 'r', encoding='utf-8') as f:
            app.config['BANK_DATA'] = json.load(f)
            app.logger.info(f"Successfully loaded bank data from {data_path}")
    except FileNotFoundError:
        app.config['BANK_DATA'] = {}
        app.logger.error(f"Bank data file not found at {data_path}")
    except json.JSONDecodeError:
        app.config['BANK_DATA'] = {}
        app.logger.error(f"Error decoding JSON from {data_path}")
    except Exception as e:
        app.config['BANK_DATA'] = {}
        app.logger.error(f"Error loading bank data: {e}")


def create_app(config_class=Config):
    """Creates and configures the Flask application."""
    app = Flask(__name__, static_folder='static')
    app.config.from_object(config_class)

    with app.app_context():
        load_bank_data(app)

    api = Api(
        app,
        version='1.0.0',
        title='Card Block API',
        description='API for accessing verified bank card blocking information for Indian banks',
        prefix='/api/v1',
        doc='/api/docs',
        contact='Cashless Consumer',
        contact_url='https://cashlessconsumer.in'
    )

    from .api.banks import api as banks_ns, export_api as export_ns
    api.add_namespace(banks_ns, path='/banks')
    api.add_namespace(export_ns, path='/export')

    @app.route('/')
    def serve_ui():
        return send_from_directory(app.static_folder, 'index.html')

    @app.route('/static/<path:filename>')
    def serve_static(filename):
        return send_from_directory(app.static_folder, filename)

    app.logger.info("Card Block API application created successfully.")
    return app
