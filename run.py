import os
from app import create_app

# Create the Flask app
# Use FLASK_ENV to determine config (matches render.yaml)
config_name = 'production' if os.environ.get('FLASK_ENV') == 'production' else 'development'
app = create_app(config_name)

if __name__ == '__main__':
    # This is only for local development
    # In production, Gunicorn will import this file and use the 'app' object
    app.run(host='0.0.0.0', port=5010, debug=False)