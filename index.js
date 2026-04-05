const express = require("express");
const path = require("path");
const { engine: hbs } = require("express-handlebars");
const dotenv = require("dotenv");
const morgan = require("morgan");
const { uuid } = require("uuidv4");

// Require the parts of the module you want to use. #adyen.
const { Client, CheckoutAPI, Types} = require("@adyen/api-library");
const { MerchantAccount } = require("@adyen/api-library/lib/src/typings/terminalManagement/merchantAccount");

const app = express();

app.use(morgan("dev"));
app.use(express.json()); // url encoded bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "/public")));

dotenv.config({
    path: "./.env",
});

app.engine(
    "handlebars",
    hbs({
        defaultLayout: "main",
        layoutsDir: __dirname + "/views/layouts",
        partialsDir: __dirname + "/views/components"
    })
);

app.set("view engine", "handlebars");

// Set up the client and service. #adyen.
const apiKey = process.env.API_KEY;

const client = new Client({ apiKey: apiKey, environment: "TEST" });

// Instaciating our checkout with the Client. #adyen.
const checkoutApi = new CheckoutAPI(client);

/* as a test im not using idempotencyKey. #adyen.
// Include your idempotency key when you make an API request. #adyen.
const requestOptions = { idempotencyKey: "YOUR_IDEMPOTENCY_KEY" };
*/

/* Products */
const products = [
  { name: 'Sunglasses',      price: 50,  emoji: '🕶️'  },
  { name: 'Headphones',      price: 50,  emoji: '🎧'  },
  { name: 'Sneakers',        price: 120, emoji: '👟'  },
  { name: 'Backpack',        price: 80,  emoji: '🎒'  },
  { name: 'Smart Watch',     price: 200, emoji: '⌚'  },
  { name: 'Laptop Stand',    price: 45,  emoji: '💻'  },
  { name: 'Wireless Mouse',  price: 35,  emoji: '🖱️'  },
  { name: 'Water Bottle',    price: 25,  emoji: '🧴'  },
  { name: 'Notebook',        price: 15,  emoji: '📓'  },
  { name: 'USB-C Hub',       price: 60,  emoji: '🔌'  },
];

function getTwoRandom(arr) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 2);
}

// Get checkout page. #adyen.
app.get('/', async (req, res) => {
  try {
    const selectedProducts = getTwoRandom(products);
    const total = selectedProducts.reduce((sum, p) => sum + p.price, 0);
    res.render('checkout', { products: selectedProducts, total, clientKey: process.env.CLIENT_KEY });
  } catch (error) {
    console.log(error);
  }
});

// Routing for the status HTML pages shown after a payment attempt. #adyen.
app.get('/success', (req, res) => res.render('success'));
app.get('/failed',  (req, res) => res.render('failed'));
app.get('/pending', (req, res) => res.render('pending'));

// Session call made by the server, it will be started by the frontend JS. #adyen.
app.post('/api/sessions', async (req, res) => {
  try {
    // Generate a unique reference for this order (so we can track it).
    const orderRef = uuid();

    // The amount the customer will pay, sent from the frontend.
    const amountValue = req.body.amount;

    // Build the return URL: where Adyen will send the customer back
    // after redirect-based payments (e.g. PayPal, iDEAL).
    const protocol = req.socket.encrypted ? 'https' : 'http';
    const baseUrl  = `${protocol}://${req.get('host')}`;
    const returnUrl = `${baseUrl}/handleShopperRedirect?orderRef=${orderRef}`;

    // Call Adyen's API to create a session.
    const response = await checkoutApi.PaymentsApi.sessions({
      amount: {
        currency: 'USD',
        value: amountValue
      },
      countryCode: 'US',
      merchantAccount: process.env.MERCHANT_ACCOUNT,
      reference: orderRef,
      returnUrl: returnUrl,
      allowedPaymentMethods: ["scheme", "paypal"], // filter just to allow card and paypal 
    });

    // Send the session id and sessionData back to the browser.
    // The Drop-in needs both to initialize.
    res.json(response);
  } catch (error) {
    console.error('Session creation error:', error.message);
    res.status(500).json({ error: 'Could not create payment session' });
  }
});

// Redirect the client to the correct page after payment atempt. #adyen.
app.all('/handleShopperRedirect', async (req, res) => {
  try {
    // The redirect data comes as a query param (GET) or body (POST).
    const redirect = req.method === 'GET' ? req.query : req.body;

    // Build the "details" object that Adyen expects.
    const details = {};
    if (redirect.redirectResult) {
      details.redirectResult = redirect.redirectResult;
    } else if (redirect.payload) {
      details.payload = redirect.payload;
    } else {
      // No payment data — something went wrong, send to failed.
      return res.redirect('/failed');
    }

    // Submit the details to Adyen to get the final payment result.
    const response = await checkoutApi.PaymentsApi.paymentsDetails({ details });

    // Redirect the customer to the right result page based on Adyen's answer.
    switch (response.resultCode) {
      case 'Authorised':
        return res.redirect('/success');
      case 'Pending':
      case 'Received':
        return res.redirect('/pending');
      default:
        return res.redirect('/failed');
    }
  } catch (error) {
    console.error('Redirect handling error:', error.message);
    res.redirect('/failed');
  }
});

//start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));