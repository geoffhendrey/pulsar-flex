const { Producer } = require('../../src');
const config = require('../config');
const assert = require('assert');
const utils = require('../utils');

const { jwt, discoveryServers, topic, containerName } = config;

describe('Producer tests', function () {
  describe('on creating & closing ', function () {
    it('should not throw exception', async function () {
      try {
        const producer = new Producer({
          discoveryServers,
          jwt,
          topic,
        });
        await producer.create();
        await producer.close();
        assert.ok(true);
      } catch (e) {
        console.log(e);
        assert.ok(false);
      }
    });
  });
  describe('on creating multiple exclusive producers', function () {
    it('should throw exception', async function () {
      await assert.rejects(
        async () => {
          const firstProducer = new Producer({
            discoveryServers,
            jwt,
            topic,
            producerAccessMode: Producer.ACCESS_MODES.EXCLUSIVE,
          });
          const secondProducer = new Producer({
            discoveryServers,
            jwt,
            topic,
            producerAccessMode: Producer.ACCESS_MODES.EXCLUSIVE,
          });
          try {
            await firstProducer.create();
            await secondProducer.create();
            await firstProducer.sendMessage({
              payload: 'asdf',
              properties: { k: 'v' },
            });

            await secondProducer.sendMessage({
              payload: 'asdf',
              properties: { k: 'v' },
            });
            await firstProducer.close();
            await secondProducer.close();
          } catch (e) {
            await firstProducer.close();
            throw e;
          }
        },
        {
          name: 'PulsarFlexProducerCreationError',
        }
      );
    });
  });
  describe('on creating multiple shared producers', function () {
    it('should not throw exception', async function () {
      try {
        const firstProducer = new Producer({
          discoveryServers,
          jwt,
          topic,
          producerAccessMode: Producer.ACCESS_MODES.SHARED,
        });
        const secondProducer = new Producer({
          discoveryServers,
          jwt,
          topic,
          producerAccessMode: Producer.ACCESS_MODES.SHARED,
        });
        await firstProducer.create();
        await secondProducer.create();
        await firstProducer.sendMessage({
          payload: 'asdf',
          properties: { k: 'v' },
        });

        await secondProducer.sendMessage({
          payload: 'asdf',
          properties: { k: 'v' },
        });
        await firstProducer.close();
        await secondProducer.close();
        assert.ok(true);
      } catch (e) {
        await firstProducer.close();
        await secondProducer.close();
        console.log(e);
        assert.ok(false);
      }
    });
  });
  describe('on creating exclusive producer and "wait for exclusive" producer', function () {
    it('should not throw exception', async function () {
      const firstProducer = new Producer({
        discoveryServers,
        jwt,
        topic,
        producerAccessMode: Producer.ACCESS_MODES.WAITFOREXCLUSIVE,
      });
      const secondProducer = new Producer({
        discoveryServers,
        jwt,
        topic,
        producerAccessMode: Producer.ACCESS_MODES.WAITFOREXCLUSIVE,
      });
      try {
        await firstProducer.create();
        await secondProducer.create();
        console.log('created both');
        await firstProducer.sendMessage({
          payload: 'asdf',
          properties: { k: 'v' },
        });
        await firstProducer.close();
        console.log('closed first');
        await utils.sleep(1000);
        await secondProducer.sendMessage({
          payload: 'asdf',
          properties: { k: 'v' },
        });
        console.log('sent second');
        await secondProducer.close();
        assert.ok(true);
      } catch (e) {
        await firstProducer.close();
        await secondProducer.close();
        console.log(e);
        assert.ok(false);
      }
    });
  });
  describe('on producerClose the producer continues sending messages', function () {
    it('should not throw exception', async function () {
      const firstProducer = new Producer({
        discoveryServers,
        jwt,
        topic,
      });
      try {
        await firstProducer.create();
        let unloaded = false;
        utils.unloadTopic().then(() => (unloaded = true));
        let i = 0;
        while (i < 2) {
          await firstProducer.sendMessage({
            payload: 'asdf',
            properties: { k: 'v' },
          });
          unloaded && i++;
        }
        await firstProducer.close();
        assert.ok(true);
      } catch (e) {
        await firstProducer.close();
        console.log(e);
        assert.ok(false);
      }
    });
  });
  describe('on connection exception should resend message', function () {
    it('should not throw exception', async function () {
      const producer = new Producer({
        discoveryServers,
        jwt,
        topic,
      });
      await producer.create();
      const goodClient = producer._client.getCnx();
      producer._client._cnx = {
        sendPayloadCommandRequest: () => {
          throw new Error('galrose');
        },
        sendSimpleCommandRequest: () => {
          throw new Error('galrose');
        },
        sendPayloadBatchCommandRequest: () => {
          throw new Error('galrose');
        },
      };
      await new Promise((resolve, reject) => {
        producer
          .sendMessage({ payload: 'sinai', properties: { k: 'v' } })
          .then(resolve)
          .catch(reject);
        producer._client._cnx = goodClient;
        const emitter = producer._client.getResponseEvents();
        setImmediate(() => emitter.emit('producerSuccess', { command: { requestId: 1 } }));
      });
    });
  });
  describe('on connection exception should resend batch', function () {
    it('should not throw exception', async function () {
      const producer = new Producer({
        discoveryServers,
        jwt,
        topic,
      });
      await producer.create();
      const goodClient = producer._client.getCnx();
      producer._client._cnx = {
        sendPayloadCommandRequest: () => {
          throw new Error('galrose');
        },
        sendSimpleCommandRequest: () => {
          throw new Error('galrose');
        },
        sendPayloadBatchCommandRequest: () => {
          throw new Error('galrose');
        },
      };
      await new Promise((resolve, reject) => {
        producer
          .sendBatch({ payload: 'sinai', properties: { k: 'v' } })
          .then(resolve)
          .catch(reject);
        producer._client._cnx = goodClient;
        const emitter = producer._client.getResponseEvents();
        setImmediate(() => emitter.emit('producerSuccess', { command: { requestId: 1 } }));
      });
    });
  });
});
