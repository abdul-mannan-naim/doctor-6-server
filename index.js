const express = require("express");
const cors = require('cors');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require("jsonwebtoken")
require("dotenv").config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);


const app = express()

app.use(cors());
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1zdgrcr.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri,
    {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverApi: ServerApiVersion.v1
    });



function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send("unauthorized access")
    }
    const token = authHeader.split(" ")[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: "forbidden access" })
        }
        req.decoded = decoded;
        next()
    })


}


async function run() {
    try {
        const usersCollection = client.db('mobile').collection('users')
        const productsCollection = client.db('mobile').collection('products')
        const ordersCollection = client.db('mobile').collection('orders')
        const commentsCollection = client.db('mobile').collection('comments')
        const adminsCollection = client.db('mobile').collection('admins')
        const paymentsCollection = client.db('mobile').collection('payments')


        // ------------------get all users---------------------- 

        app.get('/users', verifyJWT, async (req, res) => {
            const user = await usersCollection.find().toArray()
            res.send(user)
        })
        // -------------------make a user as a admin------------------------
        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const admin = req.body;
            const filter = { email: email }
            const options = { upsert: true }
            const requester = req.decoded.email;
            const requesterAccount = await usersCollection.findOne({ email: requester })

            if (requesterAccount.role === "admin") {
                const updateDoc = {
                    $set: admin
                }
                const doc = {
                    $set: { role: "admin" },
                }
                const userResult = await usersCollection.updateOne(filter, doc, options)
                const adminResult = await adminsCollection.updateOne(filter, updateDoc, options)
                res.send({ userResult, adminResult })
            }
            else {
                res.status(403).send({ message: " UnAuthorized to make admin " })
            }
        })

        app.get('/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = await usersCollection.findOne({ email: email })
            const isAdmin = query.role === "admin"
            res.send({ admin: isAdmin })
        })

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email }
            const options = { upsert: true }
            const doc = {
                $set: user,
            }
            const result = await usersCollection.updateOne(filter, doc, options)
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: "1h" })
            res.send({ result, token })
        })


        //   Post A product to database...
        app.post('/product', async (req, res) => {
            const query = req.body;
            const result = await productsCollection.insertOne(query)
            res.send(result)
        })
        //   get a product from database...
        app.get('/getProduct', async (req, res) => {
            const query = {};
            const result = await productsCollection.find(query).toArray()
            res.send(result)
        })
        //   update A product to database...
        app.put('/update/:id', async (req, res) => {
            const id = new ObjectId(req.params.id);
            const query = req.body;
            const filter = { _id: id }
            const options = { upsert: true };
            const doc = {
                $set: query
            }
            const result = await productsCollection.updateOne(filter, doc, options)
            res.send(result)

        })
        //   delete a product from database...
        app.delete('/delete/:id', async (req, res) => {
            const id = new ObjectId(req.params.id);
            const filter = { _id: id }
            const result = await productsCollection.deleteOne(filter);
            res.send(result)
        })
        //    get specific product
        app.get('/getproductbysearch', verifyJWT, async (req, res) => {
            const query = {};
            const result = await productsCollection.find(query).toArray()
            res.send(result)
        })

        // -------------------------------rating--------------------------- 
        app.put('/rating/:id', verifyJWT, async (req, res) => {
            const id = new ObjectId(req.params.id);
            const requester = req.decoded.email;
            const { ratin } = req.body;
            const user = {
                rating: ratin,
                rater: requester,
            }
            const filter = { _id: id }
            const specificProduct = await productsCollection.findOne(filter)
            const { rating } = specificProduct

            const specificRater = await rating.filter(item => item.rater === requester).length
            const options = { upsert: true };
            if (specificRater < 1) {
                const doc = {
                    $push: {
                        rating: {
                            $each: [user],
                            $position: 0
                        }
                    }
                }
                const result = await productsCollection.updateOne(filter, doc, options)
                return res.send({ success: true, result })
            }

            else if (specificRater > 0) {
                return res.send({ success: false, message: "You Already Rated" })
            }
        })
        //  -------------check rater by email id or find rater by email id------ 
        app.get('/rating/:id', verifyJWT, async (req, res) => {
            const id = new ObjectId(req.params.id);
            const requester = req.decoded.email;
            const filter = { _id: id }
            const specificProduct = await productsCollection.findOne(filter)
            const { rating } = specificProduct
            const specificRater = await rating.find(item => item.rater === requester)
            res.send(specificRater)
        })
        // -------------------------comment post---------------------------------
        app.post('/comment', verifyJWT, async (req, res) => {
            const query = req.body;
            const result = await commentsCollection.insertOne(query)
            res.send(result)
        })

        // ---------------------------get comment for specific product----------- 
        app.get('/comment/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { productId: id }
            const result = await commentsCollection.find(filter).toArray()
            res.send(result)
        })
        // -----------------------delete comment--------------------------------- 
        app.delete('/comment/:id', verifyJWT, async (req, res) => {
            const id = new ObjectId(req.params.id);
            const filter = { _id: id }
            const result = await commentsCollection.deleteOne(filter)
            res.send(result)
        })

        //  ------------------------------------------------------------ 
        // ------------------a customer can orders our products--------- 
        // -------------------------------------------------------------
        app.post('/order', verifyJWT, async (req, res) => {
            const query = req.body;
            const result = await ordersCollection.insertOne(query)
            res.send(result)
        })

        // -----------a specific customer can see his/her orders-------- 
        app.get('/myOrders', verifyJWT, async (req, res) => {
            const user = req.query.user;
            const decodedEmail = req.decoded.email;
            if (user === decodedEmail) {
                // const query = { user: user }
                const query = {
                    $and: [
                        { user: user },
                        { hide: false }
                    ]
                }
                const bookings = await ordersCollection.find(query).toArray()
                res.send(bookings)
            }
            else {
                return res.status(403).send({ message: "forbidden access" })
            }
        })

        // -----------a specific customer can see his/her hided orders-------- 
        app.get('/myHidedOrders', verifyJWT, async (req, res) => {
            const user = req.query.user;
            const decodedEmail = req.decoded.email;
            if (user === decodedEmail) {
                const query = {
                    $and: [
                        { user: user },
                        { hide: true }
                    ]
                }
                const bookings = await ordersCollection.find(query).toArray()
                res.send(bookings)
            }
            else {
                return res.status(403).send({ message: "forbidden access" })
            }
        })

        app.delete('/myOrder/:id', async (req, res) => {
            const id = new ObjectId(req.params.id)
            const filter = { _id: id };
            const result = await ordersCollection.deleteOne(filter);
            res.send(result)
        })

        app.patch('/myOrder/:id', async (req, res) => {
            const id = new ObjectId(req.params.id)
            const filter = { _id: id };
            const doc = {
                $set: {
                    hide: true,
                }
            }
            const result = await ordersCollection.updateOne(filter, doc)
            res.send(result)
        })

        // --------------------------------------

        app.get('/myOrder/:id', async (req, res) => {
            const id = new ObjectId(req.params.id);
            const query = { _id: id }
            const result = await ordersCollection.findOne(query)
            res.send(result)
        })
        // --------------customer wants to payment------
        app.post('/create-payment-intent', async (req, res) => {
            const service = req.body;
            const price = service.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"]
            })
            res.send({ clientSecret: paymentIntent.client_secret })
        })
        // ------------------------update a order after payment-----------------------------
        app.patch('/order/:id', async (req, res) => {
            const id = new ObjectId(req.params.id);
            const payment = req.body;
            // ---------------------
            const { specificPd, quantity } = req.body;
            const specificProduct = new ObjectId(specificPd)
            const search = { _id: specificProduct }
            const doc = {
                $push: {
                    totalOrder: {
                        $each: [quantity],
                        $position: 0
                    }
                }
            }
            const ProductsUpd = await productsCollection.updateOne(search, doc)
            // -----------------

            const filter = { _id: id }
            const updateDoc = {
                $set: {
                    paid: true,
                    shipped: false,
                    delivered: false,
                    transactionId: payment.transactionId,
                }
            }
            const result = await paymentsCollection.insertOne(payment)
            const updateOrder = await ordersCollection.updateOne(filter, updateDoc)
            res.send(updateDoc)
        })

        // --------------get not shipped Order and update it Shipped---------------- 

        app.get('/notShipped', async (req, res) => {
            const query = { shipped: false }
            const result = await ordersCollection.find(query).toArray()
            res.send(result)
        })

        app.patch('/shipped/:id', async (req, res) => {
            const id = new ObjectId(req.params.id)
            const filter = { _id: id }
            const doc = {
                $set: {
                    shipped: true,
                }
            }
            const result = await ordersCollection.updateOne(filter, doc)
            res.send(result)
        })

        //  ---------------get not delivered order and update it delivered---------------- 

        app.get('/notDelivered', async (req, res) => {
            const query = {
                $and: [
                    { shipped: true },
                    { delivered: false }
                ]
            }
            const result = await ordersCollection.find(query).toArray()
            res.send(result)
        })
        app.patch('/delivered/:id', async (req, res) => {
            const id = new ObjectId(req.params.id)
            const filter = { _id: id }
            const doc = {
                $set: {
                    delivered: true,
                }
            }
            const result = await ordersCollection.updateOne(filter, doc)
            res.send(result)
        })

        //  ---------------get delivered order---------------- 

        app.get('/delivered', async (req, res) => {
            const query = { delivered: true }
            const result = await ordersCollection.find(query).toArray()
            res.send(result)
        })


    } finally {

    }
}
run().catch(console.dir)

app.get('/', async (req, res) => {
    res.send("doctor portal server is running")

})

app.listen(port, () => {
    console.log(`Doctor Portal running on ${port}`)
})
