/* eslint-disable no-undef */
require('dotenv').config();

async function signIn(email, password) {
    const url = `http://${process.env.BACKEND_ADDRESS}/api/auth/sign-in`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },

        body: JSON.stringify({
            email,
            password,
        }),
    }).then((res) => res.json());

    const accessToken = response?.data?.accessToken;
    const user = response?.data?.user;
    console.log(user._id);
    // const refreshToken = response?.data?.refreshToken;
    return { token: accessToken, userId: user._id };
}

async function getRooms(token) {
    // const accessToken = response?.data?.accessToken;
    // const refreshToken = response?.data?.refreshToken;
    const url = `http://${process.env.BACKEND_ADDRESS}/api/rooms?limit=100&type=all`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        }
    }).then((res) => res.json());
    return response.data.items;
}

async function postMsg(token, roomId, msg) {
    const body = {
        roomId,
        content: msg,
        clientTempId: token,
    };

    const url = `http://${process.env.BACKEND_ADDRESS}/api/messages`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
    }).then((res) => res.json());
    return response;
}

module.exports = {
    signIn,
    getRooms,
    postMsg,
}