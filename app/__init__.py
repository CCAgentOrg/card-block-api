import os
import json
from flask import Flask, send_from_directory, render_template, Response, current_app
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
    from .api.bins import bins_ns
    api.add_namespace(banks_ns, path='/banks')
    api.add_namespace(export_ns, path='/export')
    api.add_namespace(bins_ns, path='/bins')

    @app.route('/')
    def serve_ui():
        return render_template('home.html', page='home')

    @app.route('/bins')
    def page_bins():
        return render_template('bins.html', page='bins')

    @app.route('/about')
    def page_about():
        return render_template('about.html', page='about')

    @app.route('/disclaimer')
    def page_disclaimer():
        return render_template('disclaimer.html', page='disclaimer')

    @app.route('/bank/<bank_id>')
    def page_bank(bank_id):
        return render_template('bank_detail.html', bank_id=bank_id, page='banks')

    @app.route('/static/<path:filename>')
    def serve_static(filename):
        return send_from_directory(app.static_folder, filename)

    @app.route('/robots.txt')
    def robots():
        content = "User-agent: *\nAllow: /\nSitemap: https://cardblock.cashlessconsumer.in/sitemap.xml\n"
        return Response(content, mimetype='text/plain')

    @app.route('/sitemap.xml')
    def sitemap():
        banks_store = current_app.config['BANK_DATA']
        bank_urls = ''
        for bank_id, bank_data in banks_store.items():
            name = bank_data.get('name', bank_id).lower().replace(' ', '-')
            bank_urls += f'  <url>\n    <loc>https://cardblock.cashlessconsumer.in/bank/{name}</loc>\n  </url>\n'

        xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://cardblock.cashlessconsumer.in/</loc>
    <priority>1.0</priority>
  </url>
{bank_urls.strip()}
</urlset>'''
        return Response(xml, mimetype='application/xml')

    app.logger.info("Card Block API application created successfully.")
    return app
