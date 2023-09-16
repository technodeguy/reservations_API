const crypto = require('crypto');
const express = require('express');
const bodyParser = require('body-parser')

const { db } = require('./db');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('OK');
});

app.post('/user/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!(email && password)) {
      return res.status(400).send({ message: 'Expected email, password' });
    }

    const userRaw = await db.query(`SELECT id, password FROM user WHERE email = '${email}' LIMIT 1`);

    if (!userRaw.length || !userRaw[0].id) {
      return res.status(404).send({ message: 'User not found' });
    }

    if (crypto.createHash('md5').update(password).digest('hex') !== userRaw[0].password) {
      return res.status(400).send({ message: 'Invalid password' });
    }

    return res.status(200).send({ message: userRaw[0] })
  } catch (err) {
    console.log('Error', err)
    return res.status(500).send({ message: 'Internal server error' })
  }
});

app.post('/user/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!(email && password)) {
      return res.status(400).send({ message: 'Expected email, password' });
    }

    await db.query(`INSERT INTO user (email, password) VALUES ('${email}', MD5('${password}'))`);

    return res.status(201).send({ message: 'OK' });
  } catch (err) {
    await db.rollback()
    if (err.code === 'ER_DUP_ENTRY') {
      if (err.sqlMessage) {
        if (err.sqlMessage.endsWith('ak_email\'')) {
          return res.status(400).send({ message: 'User with such email already exists' });
        }
      }
    }
    console.log('Error', err);
    return res.status(500).send({ message: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`reservations app listening on port ${port}`);
});
