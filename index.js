const express = require("express");
const cors = require('cors');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require("jsonwebtoken")
require("dotenv").config()


const app = express()

app.use(cors());
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1zdgrcr.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri,
     { useNewUrlParser: true,
         useUnifiedTopology: true,
          serverApi: ServerApiVersion.v1 });
           


function verifyJWT(req, res, next) {
const authHeader =req.headers.authorization;
if(!authHeader){
    return res.status(401).send("unauthorized access")
}
const token =authHeader.split(" ")[1];

jwt.verify(token, process.env.ACCESS_TOKEN, function(err,decoded){ 
    if(err){
        return res.status(403).send({message:"forbidden access"})
    }
    req.decoded=decoded;
    next()
})


}


async function run() {
    try {
        const usersCollection = client.db('mobile').collection('users')
        const productsCollection = client.db('mobile').collection('products')


        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email }
            const options = { upsert: true }
            const doc = {
                $set: user,
            }
            const result = await usersCollection.updateOne(filter, doc, options)
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h" })
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
        //   Post A product to database...
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





