const express = require('express');
const bodyParser = require('body-parser')

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('OK');
})

app.listen(port, () => {
  console.log(`reservations app listening on port ${port}`);
})
