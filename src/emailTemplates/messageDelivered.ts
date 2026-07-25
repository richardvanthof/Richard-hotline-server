export const messageDeliveredTemplate = (id: string, deliveredAt: Date, ): string => {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background-color: #f4f4f9;
                    margin: 0;
                    padding: 0;
                    color: #333;
                }
                .container {
                    max-width: 600px;
                    margin: 20px auto;
                    background: #fff;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                }
                .header {
                    text-align: center;
                    padding: 10px 0;
                    border-bottom: 1px solid #eee;
                }
                .header h1 {
                    color: #007bff;
                    margin: 0;
                }
                .content {
                    padding: 20px;
                }
                .content p {
                    line-height: 1.6;
                }
                .button {
                    display: inline-block;
                    padding: 10px 20px;
                    background-color: #007bff;
                    color: #fff;
                    text-decoration: none;
                    border-radius: 4px;
                    margin: 20px 0;
                }
                .footer {
                    text-align: center;
                    padding: 10px;
                    border-top: 1px solid #eee;
                    color: #777;
                    font-size: 0.9em;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Password Reset</h1>
                </div>
                <div class="content">
                   
                </div>
                <div class="footer">
                    <p>© 2026 Makker Hotline. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;
};