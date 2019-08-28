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

const AccountType = require('../AccountType');

class LockHashDb {
	/**
	 * Creates LockHashDb around CatapultDb.
	 * @param {module:db/CatapultDb} db Catapult db instance.
	 */
	constructor(db) {
		this.catapultDb = db;
	}

	// region lock retrieval

	/**
	 * Retrieves hash infos for given accounts.
	 * @param {module:db/AccountType} type Type of account ids.
	 * @param {array<object>} accountIds Account ids.
	 * @param {string} id Paging id.
	 * @param {int} pageSize Page size.
	 * @param {object} options Additional options.
	 * @returns {Promise.<array>} Hash lock infos for all accounts.
	 */
	hashLocksByAccounts(type, accountIds, id, pageSize, options) {
		const buffers = accountIds.map(accountId => Buffer.from(accountId));
		const fieldName = (AccountType.publicKey === type) ? 'lock.account' : 'lock.accountAddress';
		const conditions = { $and: [{ [fieldName]: { $in: buffers } }] };
		return this.catapultDb.queryPagedDocuments('hashLockInfos', conditions, id, pageSize, options)
			.then(this.catapultDb.sanitizer.copyAndDeleteIds);
	}

	/**
	 * Retrieves hash info for given hash.
	 * @param {Uint8Array} hash Lock hash.
	 * @returns {Promise.<object>} Hash lock info for a hash.
	 */
	hashLockByHash(hash) {
		return this.catapultDb.queryDocument('hashLockInfos', { 'lock.hash': Buffer.from(hash) })
			.then(this.catapultDb.sanitizer.copyAndDeleteId);
	}

	// endregion
}

module.exports = LockHashDb;
