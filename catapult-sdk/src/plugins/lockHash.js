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

/** @module plugins/lockHash */
const EntityType = require('../model/EntityType');
const ModelType = require('../model/ModelType');
const sizes = require('../modelBinary/sizes');

const constants = { sizes };

/**
 * Creates a lock hash plugin.
 * @type {module:plugins/CatapultPlugin}
 */
const lockHashPlugin = {
	registerSchema: builder => {
		builder.addSchema('hashLockInfo', {
			lock: { type: ModelType.object, schemaName: 'hashLockInfo.lock' }
		});
		builder.addSchema('hashLockInfo.lock', {
			account: ModelType.binary,
			accountAddress: ModelType.binary,
			mosaicId: ModelType.uint64,
			height: ModelType.uint64,
			hash: ModelType.binary
		});

		builder.addTransactionSupport(EntityType.hashLock, {
			mosaic: ModelType.uint64,
			duration: ModelType.uint64,
			hash: ModelType.binary
		});
	},

	registerCodecs: codecBuilder => {
		codecBuilder.addTransactionSupport(EntityType.hashLock, {
			deserialize: parser => {
				const transaction = {};
				transaction.mosaic = parser.uint64();
				transaction.duration = parser.uint64();
				transaction.hash = parser.buffer(constants.sizes.hash256);
				return transaction;
			},

			serialize: (transaction, serializer) => {
				serializer.writeUint64(transaction.mosaic);
				serializer.writeUint64(transaction.duration);
				serializer.writeBuffer(transaction.hash);
			}
		});
	}
};

module.exports = lockHashPlugin;
