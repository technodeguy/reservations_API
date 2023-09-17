const crypto = require('crypto');
const express = require('express');
const bodyParser = require('body-parser')

const { db } = require('./db');
const { groupItemsByKey } = require('./utils');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('OK');
});


/* 
* Sign in user
*/
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


/* 
* Sign up user
*/
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

/* 
* Create reservation
*/
app.post('/reservation', async (req, res) => {
  const { startTime, endTime, date, amenityId, userId } = req.body;
  try {
    if (!(startTime && endTime && date && amenityId && userId)) {
      return res.status(400).send({ message: 'Expected startTime, endTime, date, amenityId, userId' });
    }

    const userRaw = await db.query(`SELECT id FROM user WHERE id = ${userId} LIMIT 1`);

    if (!userRaw.length || !userRaw[0].id) {
      return res.status(404).send({ message: 'User with such id not found' });
    }

    const amenityRaw = await db.query(`SELECT id FROM amenity WHERE id = ${amenityId} LIMIT 1`);

    if (!amenityRaw.length || !amenityRaw[0].id) {
      return res.status(404).send({ message: 'Amenity with such id not found' });
    }

    const reservationId = await db.insertWithGetId(`INSERT INTO reservation (start_time, end_time, date, amenity_id, user_id) VALUES (${startTime}, ${endTime}, ${date}, ${amenityId}, ${userId})`);

    return res.status(201).send({ message: 'OK', id: reservationId });
  } catch (err) {
    console.log('Error', err);
    return res.status(500).send({ message: 'Internal server error' });
  }
});
/* 
* Get amenity reservations by amenity id
*/

/* 
* Get user reservations by user id
*/
app.get('/user/reservations/:user_id', async (req, res) => {
  const { user_id: userId } = req.params;
  try {
    if (!userId) {
      return res.status(400).send({ message: 'Expected userId' });
    }

    const userReservations = await db.query(`SELECT * FROM reservation WHERE user_id = ${userId}`);

    const groupedReservationsByDate = groupItemsByKey(userReservations, 'date');
    
    return res.status(200).send({ userReservations: groupedReservationsByDate });
  } catch (err) {
    console.log('Error', err);
    return res.status(500).send({ message: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`reservations app listening on port ${port}`);
});

