/*
 * Copyright (c) 2016-present,
 * Jaguar0625, gimre, BloodyRookie, Tech Bureau, Corp. All rights reserved.
 *
 * This file is part of Catapult.
 *
 * Catapult is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Catapult is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Catapult.  If not, see <http://www.gnu.org/licenses/>.
 */

const LockSecretDb = require('../../../src/plugins/lockSecret/LockSecretDb');
const dbTestUtils = require('../../db/utils/dbTestUtils');
const test = require('../../testUtils');
const MongoDb = require('mongodb');

const { Binary } = MongoDb;

const createLockSecretInfo = (id, owner, hashPropertyName, value) => ({
	_id: dbTestUtils.db.createObjectId(id),
	meta: {},
	lock: {
		account: new Binary(owner.publicKey),
		accountAddress: new Binary(owner.address),
		[hashPropertyName]: new Binary(value)
	}
});

const createLockSecretInfos = ((numRounds, owner, hashPropertyName, startdId = 0) => {
	const lockInfos = [];

	for (let i = 0; i < numRounds; ++i)
		lockInfos.push(createLockSecretInfo(startdId + i, owner, hashPropertyName, test.random.hash()));

	return lockInfos;
});

const lockSecretDbTestUtils = {
	db: {
		createSecretLockInfo: (id, owner, value) => createLockSecretInfo(id, owner, 'secret', value),
		createSecretLockInfos: (numRounds, owner, startdId = 0) => createLockSecretInfos(numRounds, owner, 'secret', startdId),
		runDbTest: (lockName, dbEntities, issueDbCommand, assertDbCommandResult) =>
			dbTestUtils.db.runDbTest(dbEntities, `${lockName}LockInfos`, db => new LockSecretDb(db), issueDbCommand, assertDbCommandResult)
	}
};
Object.assign(lockSecretDbTestUtils, test);

module.exports = lockSecretDbTestUtils;
