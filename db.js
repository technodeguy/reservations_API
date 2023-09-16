const util = require('util');
const mysql = require('mysql');

class DB {
    constructor() {
        this._con = mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_USER_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT,
            multipleStatements: true,
        });

        console.log()

        this.connect = util.promisify(this._con.connect).bind(this._con);
        this.beginTransaction = util.promisify(this._con.beginTransaction).bind(this._con);
        this.commit = util.promisify(this._con.commit).bind(this._con);
        this.rollback = util.promisify(this._con.rollback).bind(this._con);
        this.query = util.promisify(this._con.query).bind(this._con);

        this.init();
    }

    async init() {
        await this.connect();
        console.log('DB: connected to the database')
    }

    escape(sql) {
        return this._con.escape(sql);
    }

    async insertWithGetId(insertSql) {
        let result = await this.query(`${insertSql}; SELECT LAST_INSERT_ID() as id;`);
        return result[1][0].id;
    }

    end() {
        this._con.end();
    }

    format(query, newData) {
        return mysql.format(query, newData);
    }
}

exports.db = new DB();