# Keyserver API

## Definitions

* `JWS`: function acting on a serializable javascript `Object` that returns the JSON Web Signature over its JSON representation.
* `KeyInput`:

        {
          t: <number>, // timestamp in seconds
          deviceid: <string>, // unique device ID
          userid: <string>, // user's email address
          key: <string> // unarmored, websafe base64-encoded OpenPGP key
        }

## Sending keys

This registers a new key with the keyserver if there does not exist one for the userid + deviceid. Otherwise it updates the existing key.

The userid is the email address of the user, and the deviceid is a random string unique to each end-to-end installation.

* Request

        POST /v1/k/<userid>/<deviceid> KeyInput

* Response

        JWS(KeyInput)

## Fetching keys

* Request

        GET /v1/k/<userid>

* Response (returns 404 if no keys are registered)

        JWS({
          t: <number>, // timestamp in seconds
          userid: <string>, // user's email address
          keys: Object.<string, string> // key-value pairs of {<deviceid>: JWS(KeyInput)}
        })

## Deleting keys

TODO
