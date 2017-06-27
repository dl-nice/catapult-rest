import { expect } from 'chai';
import { verify } from '../../src/crypto/keyPair';
import PacketType from '../../src/packet/PacketType';
import verifyPeer from '../../src/auth/verifyPeer';
import VerifyResult from '../../src/auth/VerifyResult';
import test from './utils/authUtils';

describe('verify peer', () => {
	describe('verify server', () => {
		function generateServerChallengeRequest() {
			const parsedRequest = test.packets.generateServerChallengeRequest();
			return {
				type: parsedRequest.type,
				size: 0x00000048,
				payload: parsedRequest.challenge
			};
		}

		function generateClientChallengeResponse(serverResponse, serverKeyPair) {
			const parsedResponse = test.packets.generateClientChallengeResponse(serverResponse, serverKeyPair);
			return {
				type: parsedResponse.type,
				size: 0x00000048,
				payload: parsedResponse.signature
			};
		}

		function createHandlerContext() {
			// Arrange:
			const state = {
				writtenPayloads: [],
				verifyResult: undefined
			};

			const serverSocket = {
				write: payload => state.writtenPayloads.push(payload)
			};

			const clientKeyPair = test.random.keyPair();
			const serverKeyPair = test.random.keyPair();
			const verifier = verifyPeer.createServerVerifier(serverSocket, clientKeyPair, serverKeyPair.publicKey);

			const handler = verifier.handler;
			verifier.on('verify', result => {
				// Sanity: verify event should only be raised once
				expect(state.verifyResult).to.equal(undefined);

				state.verifyResult = result;
			});

			return {
				config: { serverSocket, clientKeyPair, serverKeyPair },
				state,
				handler,

				authenticate: () => {
					// - create and process the server request
					const serverRequest = generateServerChallengeRequest();
					handler(serverRequest);

					// - extract the response challenge
					expect(state.writtenPayloads.length).to.equal(1);
					const serverResponse = test.packets.parseServerChallengeResponse(state.writtenPayloads[0]);

					// - create and process the client response
					const clientResponse = generateClientChallengeResponse(serverResponse, serverKeyPair);
					handler(clientResponse);
					return { serverRequest, clientResponse };
				}
			};
		}

		describe('events', () => {
			it('on allows chaining', () => {
				// Arrange:
				const clientKeyPair = test.random.keyPair();
				const serverKeyPair = test.random.keyPair();
				const verifier = verifyPeer.createServerVerifier({}, clientKeyPair, serverKeyPair.publicKey);

				// Act:
				const result = verifier.on('verify', () => {});

				// Assert:
				expect(result).to.equal(verifier);
			});
		});

		describe('server challenge', () => {
			it('writes to socket if first packet', () => {
				// Arrange:
				const context = createHandlerContext();
				const request = generateServerChallengeRequest();

				// Act:
				context.handler(request);

				// Assert: the verify result is indeterminate
				expect(context.state.verifyResult).to.equal(undefined);

				// - response
				expect(context.state.writtenPayloads.length).to.equal(1);
				const response = test.packets.parseServerChallengeResponse(context.state.writtenPayloads[0]);
				expect(response.size).to.equal(168);
				expect(response.type).to.equal(PacketType.serverChallenge);

				expect(response.challenge).to.not.deep.equal(new Uint8Array(64)); // challenge is non-zero
				expect(response.challenge).to.not.deep.equal(request.challenge); // challenge is not the same as the request challenge

				const clientKeyPair = context.config.clientKeyPair;
				const isVerified = verify(clientKeyPair.publicKey, request.payload, response.signature);
				expect(isVerified).to.equal(true);

				expect(response.publicKey).to.deep.equal(Buffer.from(clientKeyPair.publicKey));
			});

			it('is rejected if not the first packet', () => {
				// Arrange:
				const context = createHandlerContext();
				const request = generateServerChallengeRequest();
				context.handler(request);

				// Act: resend the server challenge
				context.handler(request);

				// Assert: verify handshake failed
				expect(context.state.verifyResult).to.equal(VerifyResult.malformedData);
				expect(context.state.writtenPayloads.length).to.equal(1);
			});

			it('is ignored if after authentication', () => {
				// Arrange:
				const context = createHandlerContext();
				const packets = context.authenticate();

				// Sanity:
				expect(context.state.verifyResult).to.equal(VerifyResult.success);

				// Act: resend the server challenge
				context.handler(packets.serverRequest);

				// Assert: connection is still verified
				expect(context.state.verifyResult).to.equal(VerifyResult.success);
				expect(context.state.writtenPayloads.length).to.equal(1);
			});
		});

		describe('client challenge', () => {
			function assertClientChallengeHandling(createClientResponse, expectedVerifyResult) {
				// Arrange:
				const context = createHandlerContext();
				const serverRequest = generateServerChallengeRequest();

				// - process the server request and extract the response challenge
				context.handler(serverRequest);
				expect(context.state.writtenPayloads.length).to.equal(1);
				const serverResponse = test.packets.parseServerChallengeResponse(context.state.writtenPayloads[0]);

				// - create a client response
				const clientResponse = createClientResponse(serverResponse, context.config.serverKeyPair);

				// Act:
				context.handler(clientResponse);

				// Assert:
				expect(context.state.verifyResult).to.equal(expectedVerifyResult);
				expect(context.state.writtenPayloads.length).to.equal(1);
			}

			it('is successful if server passes challenge', () => {
				// Assert:
				assertClientChallengeHandling(
					// - create a (valid) client response
					generateClientChallengeResponse,
					VerifyResult.success);
			});

			it('is rejected if server fails challenge', () => {
				// Assert:
				assertClientChallengeHandling(
					(serverResponse, serverKeyPair) => {
						// - create an invalid client response (corrupt signature)
						const clientResponse = generateClientChallengeResponse(serverResponse, serverKeyPair);
						clientResponse.payload[0] ^= 0xFF;
						return clientResponse;
					},
					VerifyResult.failedChallenge);
			});

			it('is rejected if server responds with wrong challenge', () => {
				// Assert:
				assertClientChallengeHandling(
					// - create an invalid client response (challenge does not match)
					(serverResponse, serverKeyPair) => generateClientChallengeResponse(
						{ challenge: test.random.bytes(64) },
						serverKeyPair),
					VerifyResult.failedChallenge);
			});

			it('is rejected if the first packet', () => {
				// Arrange:
				const context = createHandlerContext();

				// - create a client response
				const serverKeyPair = context.config.serverKeyPair;
				const clientResponse = generateClientChallengeResponse({ challenge: test.random.bytes(64) }, serverKeyPair);

				// Act:
				context.handler(clientResponse);

				// Assert: verify handshake failed
				expect(context.state.verifyResult).to.equal(VerifyResult.malformedData);
				expect(context.state.writtenPayloads.length).to.equal(0);
			});

			it('is ignored if after authentication', () => {
				// Arrange:
				const context = createHandlerContext();
				const packets = context.authenticate();

				// Sanity:
				expect(context.state.verifyResult).to.equal(VerifyResult.success);

				// Act: resend the client response
				context.handler(packets.clientResponse);

				// Assert: connection is still verified
				expect(context.state.verifyResult).to.equal(VerifyResult.success);
				expect(context.state.writtenPayloads.length).to.equal(1);
			});
		});

		describe('non auth packet', () => {
			it('is rejected if server challenge has not been received', () => {
				// Arrange:
				const context = createHandlerContext();

				// Act:
				context.handler({ type: 3, size: 16 });

				// Assert: verify handshake failed
				expect(context.state.verifyResult).to.equal(VerifyResult.malformedData);
				expect(context.state.writtenPayloads.length).to.equal(0);
			});

			it('is rejected if client challenge has not been received', () => {
				// Arrange:
				const context = createHandlerContext();
				context.handler(generateServerChallengeRequest());

				// Act:
				context.handler({ type: 3, size: 16 });

				// Assert: verify handshake failed
				expect(context.state.verifyResult).to.equal(VerifyResult.malformedData);
				expect(context.state.writtenPayloads.length).to.equal(1);
			});

			it('multiple errors do not trigger multiple verify events', () => {
				// Arrange:
				const context = createHandlerContext();

				// Act:
				for (let i = 0; 5 > i; ++i)
					context.handler({ type: 3, size: 16 });

				// Assert: verify handshake failed but only one event was raised (due to check in verify event handler)
				expect(context.state.verifyResult).to.equal(VerifyResult.malformedData);
				expect(context.state.writtenPayloads.length).to.equal(0);
			});

			function assertNonAuthPacketsCanBeHandledAfterAuthentication(packets) {
				// Arrange:
				const context = createHandlerContext();
				context.authenticate();

				// Sanity:
				expect(context.state.verifyResult).to.equal(VerifyResult.success);

				// Act: send all packets
				for (const packet of packets)
					context.handler(packet);

				// Assert: connection is still verified
				expect(context.state.verifyResult).to.equal(VerifyResult.success);
				expect(context.state.writtenPayloads.length).to.equal(1);
			}

			it('is ignored if connection is authenticated', () => {
				// Assert:
				assertNonAuthPacketsCanBeHandledAfterAuthentication([{ type: 3, size: 16 }]);
			});

			it('is ignored (multiple) if connection is authenticated', () => {
				// Assert:
				assertNonAuthPacketsCanBeHandledAfterAuthentication([
					{ type: 3, size: 16 },
					{ type: 4, size: 20 },
					{ type: 3, size: 12 }
				]);
			});
		});
	});
});
