const express = require("express");
const path = require("path");
const { engine: hbs } = require("express-handlebars");
const dotenv = require("dotenv");
const morgan = require("morgan");
const { uuid } = require("uuidv4");

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

app.get('/', (req, res) => {
  const selectedProducts = getTwoRandom(products);
  const total = selectedProducts.reduce((sum, p) => sum + p.price, 0);
  res.render('checkout', { products: selectedProducts, total });
});

//start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));