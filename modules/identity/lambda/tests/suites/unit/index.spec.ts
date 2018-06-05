/*
 * Copyright (c) 2018 Martin Donath <martin.donath@squidfunk.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

import { trigger } from "~/index"

import {
  mockCognitoUserPoolTriggerEvent
} from "_/mocks/vendor/aws-lambda"
import {
  mockCognitoIDPListUsersWithError,
  mockCognitoIDPListUsersWithoutResult,
  mockCognitoIDPListUsersWithResult
} from "_/mocks/vendor/aws-sdk"

/* ----------------------------------------------------------------------------
 * Tests
 * ------------------------------------------------------------------------- */

/* Lambda trigger */
describe("trigger", () => {

  /* Cognito user pool trigger event */
  const event = mockCognitoUserPoolTriggerEvent()

  /* Test: should resolve with input event */
  it("should resolve with input event", async () => {
    const listUsersMock =
      mockCognitoIDPListUsersWithoutResult()
    expect(await trigger(event)).toBe(event)
    expect(listUsersMock).toHaveBeenCalledWith({
      UserPoolId: event.userPoolId,
      Filter: `email="${event.request.userAttributes.email}"`
    })
  })

  /* Test: should reject on already registered email address */
  it("should reject on already registered email address", async done => {
    mockCognitoIDPListUsersWithResult()
    try {
      await trigger(event)
      done.fail()
    } catch (err) {
      expect(err).toEqual(new Error("Email address already registered"))
      done()
    }
  })

  /* Test: should reject on AWS Cognito IDP error */
  it("should reject on AWS Cognito IDP error", async done => {
    const errMock = new Error()
    mockCognitoIDPListUsersWithError(errMock)
    try {
      await trigger(event)
      done.fail()
    } catch (err) {
      expect(err).toBe(errMock)
      done()
    }
  })
})
