const jwt = require('jsonwebtoken');

const config = {
    secret: 'secret',
    expiration: '1h',
};

class TokenService {
    generate(payload) {
        return jwt.sign(payload, config.secret, { expiresIn: config.expiration });
    }

    verify(token) {
        return jwt.verify(token, config.secret);
    }
}

module.exports = TokenService;