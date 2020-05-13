const APP_ROOT = '../../'
const _ = require('lodash')
const aws4 = require('aws4')
const URL = require('url')
const http = require('axios')

const mode = process.env.TEST_MODE

const viaHandler = async (event, functionName) => {
    const handler = require(`${APP_ROOT}/functions/${functionName}`).handler

    const context = {}
    const response = await handler(event, context)
    const contentType = _.get(response, 'headers.content-type', 'application/json');
    if (response.body && contentType === 'application/json') {
        response.body = JSON.parse(response.body);
    }
    return response
}

const respondFrom = async (httpRes) => ({
    statusCode: httpRes.status,
    body: httpRes.data,
    headers: httpRes.headers
})

const signHttpRequest = (url) => {
    const urlData = URL.parse(url)
    const opts = {
        host: urlData.hostname,
        path: urlData.pathname
    }

    aws4.sign(opts)
    return opts.headers
}

const viaHttp = async (relPath, method, opts) => {
    const url = `${process.env.rootUrl}/${relPath}`
    console.info(`invoking via HTTP ${method} ${url}`)

    try {
        const data = _.get(opts, "body")
        let headers = {}
        if (_.get(opts, "iam_auth", false) === true) {
            headers = signHttpRequest(url)
        }

        const authHeader = _.get(opts, "auth")
        if (authHeader) {
            headers.Authorization = authHeader
        }

        const httpReq = http.request({
            method, url, headers, data
        })

        const res = await httpReq
        return respondFrom(res)
    } catch (err) {
        if (err.status) {
            return {
                statusCode: err.status,
                headers: err.response.headers
            }
        } else {
            throw err
        }
    }
}


const we_invoke_get_index = async () => {
    switch (mode) {
        case 'handler':
            return await viaHandler({}, 'get-index')
        case 'http':
            return await viaHttp('', 'GET')
        default:
            throw new Error(`unsupported mode: ${mode}`)
    }
}
const we_invoke_get_restaurants = () => viaHandler({}, 'get-restaurants')

const we_invoke_search_restaurants = theme => {
    let event = {
        body: JSON.stringify({ theme })
    }
    return viaHandler(event, 'search-restaurants')
}


module.exports = {
    we_invoke_get_index,
    we_invoke_get_restaurants,
    we_invoke_search_restaurants
}