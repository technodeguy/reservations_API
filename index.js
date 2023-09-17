const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const bodyParser = require('body-parser')
const multer = require('multer');
const csv = require('csv-parse');

const { db } = require('./db');
const { groupItemsByKey } = require('./utils');
const TokenService = require('./tokenService');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

const uploadMiddleware = multer({ dest: './upload' }).single('importFile')

app.get('/', (req, res) => {
  res.send('OK');
});

const ConfigCSV = {
  delimiter:';',
  from_line: 2,
  trim: true,
};

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

    const token = new TokenService().generate({ id: userRaw[0].id });

    return res.status(200).send({ message: userRaw[0], token });
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
app.get('/amenity/reservations/:amenity_id', async (req, res) => {
  const { amenity_id: amenityId } = req.params;
  try {
    if (!amenityId) {
      return res.status(400).send({ message: 'Expected amenityId' });
    }

    const amenityReservations = await db.query(
      `
      SELECT 
        reservation.id AS reservationId,
        reservation.user_id AS userId,
        reservation.start_time AS startTime,
        (reservation.end_time - reservation.start_time) AS duration,
        amenity.name AS amenityName
      FROM reservation
      INNER JOIN amenity ON 1=1 AND
        reservation.amenity_id = amenity.id
      WHERE amenity_id = ${amenityId}`
    );
    
    return res.status(200).send({ amenityReservations });
  } catch (err) {
    console.log('Error', err);
    return res.status(500).send({ message: 'Internal server error' });
  }
});

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

function parseCSVPromise(filePath) {
  return new Promise((resolve, reject) => {
    const records = [];
    fs.createReadStream(filePath)
      .pipe(csv.parse(ConfigCSV))
      .on('data', row => {
        const [id, amenity_id, user_id, start_time, end_time, date] = row;
        records.push({id, amenity_id, user_id, start_time, end_time, date});
      })
      .on('error', error => {
        reject(error);
        throw new Error('Fail to process CSV file');
      })
      .on('end', () => {
        resolve(records);
      });
  });
}

function buildAuthMiddleware() {
  return function(req, res, next) {
    try {
      const token = req.headers['authorization'];
      if (!token) {
        throw new Error();
      }
      new TokenService().verify(token);
    } catch (err) {
      return res.status(401).send({ error: 'Unauthorized' });
    }
    next();
  }
}

/* 
* Import and parse csv file
*/
app.post('/import', [buildAuthMiddleware(), uploadMiddleware], async (req, res) => {
  const filePath = req.file.path;    
  try {
    
    const records = await parseCSVPromise(filePath);

    return res.status(200).send({ results: records });
  } catch (err) {
    console.log('Error', err);
    return res.status(500).send({ message: 'Internal server error' });
  }
})

app.listen(port, () => {
  console.log(`reservations app listening on port ${port}`);
});

