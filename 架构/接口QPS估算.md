# 面试官:知道你的接口QPS是多少么?

近期有一段聊天记录如下

<img src="https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20211011160648346.png" alt="image-20211011160648346" style="zoom: 25%;" />

看到这里，不要吃惊，不要惊讶！

那个很猥琐的，没有打码的头像，正是渣渣烟本人(此处应有反驳的声音，那个头像哪里猥琐了，分明帅气逼人好么)！

所以，牛皮都吹出去了。写个文章，自己给自己圆上！

## **正文**

### **QPS是什么** 

我们先回忆一下，QPS的概念如下所示:

> **QPS（Query Per Second）：每秒请求数，就是说服务器在一秒的时间内处理了多少个请求。**

那我们怎么估出每秒钟能处理多少请求呢？ OK，用日志来估计！那日志怎么记录呢，细分下来，有两种方式。 *方式一:自己在接口里记录* 这种方式指的是在你的接口里，日志记录了能体现该接口特性的，并具有唯一性的字符串！ 例如，下面这一段代码

```javascript
@RestController  
@RequestMapping("/home")  
public class IndexController {
    //省略
    @RequestMapping("/index")  
    String index() {  
        logger.info("渣渣烟");
        return "index";  
    }  
}  
```

假设现在我要统计index这个接口的QPS！ OK，什么叫能体现该接口特性的字符串呢！就像上面的"渣渣烟"这个字符串，只在index这个接口里出现过，没在其他其他接口里出现过！因此，只要统计出"渣渣烟"这个字符串在日志里的出现次数，就能知道该接口的请求次数！

什么叫具有唯一性的字符串呢！所谓唯一性，指的是"渣渣烟"这个字符串，在这个接口的一次调用流程中，只出现一次！如果出现两次，就会导致到时候统计出来的次数会多一倍，所以尽量选择具有唯一性的字段！

*方式二:利用tomcat的access log* 如果你的日志里没有我上面提到的字段。OK，那就用tomcat自带的access log功能吧！ 因为我平时内置的tomcat比较多，指定下面两个属性即可

```javascript
server.tomcat.accesslog.directory
设定log的目录，默认: logs
server.tomcat.accesslog.enabled
是否开启access log，默认: false
```

此时，你访问一次/home/index地址，会有下面这样日志

```javascript
127.0.0.1 - - [19/Aug/2019:23:55:27 +0800] "POST /home/index HTTP/1.1" 200 138
```

那么，你就可以根据日志中，该记录的出现次数，统计index接口的QPS。

### **实战** 

假设，你这会日志已经拿到手了，名字为xxx.log。 假设日志内容如下

```javascript
//省略，都长差不多，贴其中一条就行
0:0:0:0:0:0:0:1 - - [27/Dec/2018:20:41:57 +0800] "GET /mvc2/upload.do HTTP/1.1" 404 949 http-bio-8080-exec-5 43
//省略
```

这个时候，你执行一串命令长下面这样的，进行统计就行！ `cat xx.log |grep 'GET /mvc2'|cut -d ' ' -f4|uniq -c|sort -n -r` 出来等结果就是

```javascript
2 [27/Dec/2018:20:40:44
1 [27/Dec/2018:20:47:58
1 [27/Dec/2018:20:47:42
1 [27/Dec/2018:20:41:57
```

然后你就知道，原来在20:40:44 分。。这个接口的QPS最高，达到了惊人的2QPS！

现在，来讲一下命令什么意思！ `cat xxx.log`:读文件内容 `grep 'GET /mvc2'`:将文件内容按照`GET /mvc2`进行过滤 `cut -d ' ' -f4`:过滤出来的内容按照空格进行分割，取第四列内容 `uniq -c`:每列旁边显示该行重复出现的次数 `sort -n -r`:依照数值的大小排序

那么，如果是其他日志格式，无外乎cut语句的处理不同而已，道理类似！此法可以估算出单机的某接口的QPS是多少！

### **估算** 

我们现在估计出了单机的QPS。接下来，估算集群的QPS。 这就要根据[负载均衡](https://cloud.tencent.com/product/clb?from=10680)的策略来估计！ 比如，你部署了32台机器，负载均衡的策略恰巧为轮询，那集群的QPS就是单机的QPS乘32就好了。 所以，根据具体的策略，来估计整个集群的QPS多大！