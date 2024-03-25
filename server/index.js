const express = require('express');
const cors = require('cors');
const mongoose = require("mongoose");
const User = require('./models/User.js');
const Post = require('./models/Post.js');
const bcrypt = require('bcryptjs');
const app = express();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const crypto = require('crypto')
const bodyParser = require('body-parser')
const { uploadFile, deleteFile, getObjectSignedUrl } = require('./s3.js')


const corsOpts = {
  origin: ['http://localhost:3000','https://blog-bay-frontend.vercel.app','*'],

  methods: [
    'GET',
    'POST',
  ],
  credentials:true,
  allowedHeaders: [
    'Content-Type',
  ],
};

app.use(cors(corsOpts));

// multer disk storage
const multer = require('multer');
const storage = multer.memoryStorage()

const upload = multer({ storage: storage })

const salt = bcrypt.genSaltSync(10);
const secret = process.env.SECRET;


app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

const PORT = process.env.PORT || 8000

mongoose.connect(process.env.MONGO_URL)
.then(()=>{
  console.log('Connected To MongoDB')
})


const generateFileName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex')


app.post('/register', async (req,res) => {
  const {username,password} = req.body;
  if (password=='')
  {
    return res.status(400).json({error:true});
  }
  try{
    const userDoc = await User.create({
      username,
      password:bcrypt.hashSync(password,salt),
    });
    res.json(userDoc);
  } catch(e) {
    res.status(400).json(e);
  }
});


app.get('/',(req,res)=>{
  return  res.json("Server Deployed");
});

app.post('/login', async (req,res) => {
  const {username,password} = req.body;
  const userDoc = await User.findOne({username});

  if (userDoc==null)
  {
    return res.status(400).json('wrong credentials');
  }
  const passOk = bcrypt.compareSync(password, userDoc.password);
  if (passOk) {
    // logged in
    jwt.sign({username,id:userDoc._id}, secret, {}, (err,token) => {
      if (err) return res.status(400).json({error:true});
      res.cookie('token', token).json({
        id:userDoc._id,
        username,
      });
    });
  } else {
    res.status(400).json('wrong credentials');
  }
});

app.get('/profile', (req,res) => {
  const {token} = req?.cookies;
  
  if (!token)
  {
    return res.json("Token Invalid")
  }
  else
  {
    jwt.verify(token, secret, {}, (err,info) => {
    if (err) {
      return res.json({err:true})
    }
    res.json(info);
  });
  }
});

app.post('/logout', (req,res) => {
  res.cookie('token', '').json('ok');
});

app.post('/post', upload.single('file'), async (req,res) => {
  let imageName = 'defaultImage.jpg';
  if (req.file!==undefined)
  {
    imageName=generateFileName()

    const fileVar = req.file;
    await uploadFile(fileVar?.buffer, imageName, fileVar.mimetype)
  }
  const {token} = req.cookies;
  jwt.verify(token, secret, {}, async (err,info) => {
    if (err) throw err;
    const {title,summary,content} = req.body;
    const imageUrl = await getObjectSignedUrl(imageName);

    const postDoc = await Post.create({
      title,
      summary,
      content,
      imageName,
      author:info.id,
      imageUrl
    });
    res.status(200).json(postDoc);
  });
});

app.put('/post',upload.single('file'), async (req,res) => {
  const {token} = req.cookies;
  jwt.verify(token, secret, {}, async (err,info) => {
    if (err) throw err;

    const {id,title,summary,content} = req.body;
    const postDoc = await Post.findById(id);
    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
    if (!isAuthor) {
      return res.status(400).json('you are not the author');
    }

    let imageName = 'defaultImage.jpg';
    if (req.file!==undefined)
    {
      imageName=generateFileName()

      const fileVar = req.file;
      await uploadFile(fileVar?.buffer, imageName, fileVar.mimetype)
    }

    const imageUrl = await getObjectSignedUrl(imageName);
//ssh -i "blogbay_key.pem" ubuntu@ec2-15-206-54-3.ap-south-1.compute.amazonaws.com
    await Post.findOneAndUpdate({_id:id},
      {
      title,
      summary,
      content,
      imageName,
      imageUrl,
    });

    res.json(postDoc);
  });

});

app.get('/post', async (req,res) => {

  const posts =  await Post.find().populate('author', ['username']).sort({createdAt: -1}).limit(20)

  // for (let post of posts)
  // {
  //   if (post.imageName===null)
  //   continue;

  //   const imageUrl = await getObjectSignedUrl(post.imageName);

  //   if (post.imageUrl!=undefined)
  //   {
  //     continue;
  //   }

  //   await Post.findOneAndUpdate({_id:post._id},
  //   {
  //     imageUrl
  //   })
  // }

  // console.log(posts)

  res.send(posts)
});

app.get('/post/:id', async (req, res) => {
  const {id} = req.params;
  const postDoc = await Post.findById(id).populate('author', ['username']);
  res.json(postDoc);
})

app.listen(PORT,()=>{
  console.log(`Server Started at PORT ${PORT}`)
});
