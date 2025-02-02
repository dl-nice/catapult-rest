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

const EntityType = require('../../src/model/EntityType');
const ModelSchemaBuilder = require('../../src/model/ModelSchemaBuilder');
const ModelType = require('../../src/model/ModelType');
const mosaic = require('../../src/plugins/mosaic');
const test = require('../binaryTestUtils');
const { expect } = require('chai');

const constants = {
	sizes: {
		mosaicDefinition: 22,
		mosaicSupplyChange: 17
	}
};

describe('mosaic plugin', () => {
	describe('register schema', () => {
		it('adds mosaic system schema', () => {
			// Arrange:
			const builder = new ModelSchemaBuilder();
			const numDefaultKeys = Object.keys(builder.build()).length;

			// Act:
			mosaic.registerSchema(builder);
			const modelSchema = builder.build();

			// Assert:
			expect(Object.keys(modelSchema).length).to.equal(numDefaultKeys + 5);
			expect(modelSchema).to.contain.all.keys(
				'mosaicDefinition',
				'mosaicDefinition.mosaicProperty',
				'mosaicDescriptor',
				'mosaicDescriptor.mosaic',
				'mosaicSupplyChange'
			);

			// - mosaic definition
			expect(Object.keys(modelSchema.mosaicDefinition).length).to.equal(Object.keys(modelSchema.transaction).length + 2);
			expect(modelSchema.mosaicDefinition).to.contain.all.keys(['mosaicId', 'duration']);

			// - mosaic property
			expect(modelSchema['mosaicDefinition.mosaicProperty']).to.deep.equal({
				value: ModelType.uint64
			});

			// - mosaic descriptor
			expect(Object.keys(modelSchema.mosaicDescriptor).length).to.equal(2);
			expect(modelSchema.mosaicDescriptor).to.contain.all.keys(['meta', 'mosaic']);

			expect(Object.keys(modelSchema['mosaicDescriptor.mosaic']).length).to.equal(5);
			expect(modelSchema['mosaicDescriptor.mosaic']).to.contain.all.keys([
				'mosaicId', 'supply', 'height', 'owner', 'properties'
			]);

			// - mosaic supply change
			expect(Object.keys(modelSchema.mosaicSupplyChange).length).to.equal(Object.keys(modelSchema.transaction).length + 2);
			expect(modelSchema.mosaicSupplyChange).to.contain.all.keys(['mosaicId', 'delta']);
		});
	});

	describe('register codecs', () => {
		const getCodecs = () => {
			const codecs = {};
			mosaic.registerCodecs({
				addTransactionSupport: (type, codec) => { codecs[type] = codec; }
			});

			return codecs;
		};

		it('adds mosaic codecs', () => {
			// Act:
			const codecs = getCodecs();

			// Assert: codecs were registered
			expect(Object.keys(codecs).length).to.equal(2);
			expect(codecs).to.contain.all.keys([
				EntityType.mosaicDefinition.toString(),
				EntityType.mosaicSupplyChange.toString()
			]);
		});

		const getCodec = entityType => getCodecs()[entityType];

		describe('supports mosaic definition', () => {
			const generateTransaction = () => ({
				buffer: Buffer.concat([
					Buffer.of(0x06, 0xFF, 0xCA, 0xB8), // mosaic nonce
					Buffer.of(0xF2, 0x26, 0x6C, 0x06, 0x40, 0x83, 0xB2, 0x92), // mosaic id
					Buffer.of(0x11), // flags
					Buffer.of(0x66), // divisibility
					Buffer.of(0xFA, 0x62, 0xCC, 0x56, 0x42, 0x37, 0xBB, 0xD2) // duration
				]),

				object: {
					nonce: 3100311302,
					mosaicId: [0x066C26F2, 0x92B28340],
					flags: 0x11,
					divisibility: 0x66,
					duration: [0x56CC62FA, 0xD2BB3742]
				}
			});

			test.binary.test.addAll(getCodec(EntityType.mosaicDefinition), constants.sizes.mosaicDefinition, generateTransaction);
		});

		describe('supports mosaic supply change', () => {
			const generateTransaction = () => ({
				buffer: Buffer.concat([
					Buffer.of(0xF2, 0x26, 0x6C, 0x06, 0x40, 0x83, 0xB2, 0x92), // mosaic id
					Buffer.of(0x01), // direction
					Buffer.of(0xCA, 0xD0, 0x8E, 0x6E, 0xFF, 0x21, 0x2F, 0x49) // delta
				]),

				object: {
					direction: 0x01,
					mosaicId: [0x066C26F2, 0x92B28340],
					delta: [0x6E8ED0CA, 0x492F21FF]
				}
			});

			test.binary.test.addAll(getCodec(EntityType.mosaicSupplyChange), constants.sizes.mosaicSupplyChange, generateTransaction);
		});
	});
});
